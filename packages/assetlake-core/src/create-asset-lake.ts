import {
  type AssetLakeConfigInput,
  parseAssetLakeConfig,
} from "./client/config";
import type {
  AssetLakeImageResult,
  EntityRef,
  ImagePurpose,
  ResponsiveImage,
} from "./contracts";
import { createImageUrls } from "./delivery/image-urls";
import { AssetLakeError } from "./errors/asset-lake-error";
import { createDeleteImage } from "./images/delete-image";
import { cryptoIdGenerator, type IdGenerator } from "./images/image-id";
import { normalizeImage, toResultStatus } from "./images/normalize";
import { type Clock, createUploadImage } from "./images/upload-image";
import { createJsonLogger, type Logger } from "./logging/logger";
import { createPresetResolver } from "./presets/preset-resolver";
import type { SetupPlan } from "./setup/setup-plan";
import type { AssetLakeStore } from "./store/asset-lake-store";
import {
  createSanityStore,
  createSanityWriteClient,
} from "./store/sanity-store";
import type { SetupMode, SetupStore } from "./store/setup-store";

export interface AssetLakeOverrides {
  store?: AssetLakeStore & SetupStore;
  logger?: Logger;
  clock?: Clock;
  ids?: IdGenerator;
}

const systemClock: Clock = { now: () => new Date() };

/** Server-only entry point (holds the write token). Browser code uses "@assetlake/core/url". */
export function createAssetLake(
  configInput: AssetLakeConfigInput,
  overrides: AssetLakeOverrides = {},
) {
  const config = parseAssetLakeConfig(configInput);
  const store =
    overrides.store ?? createSanityStore(createSanityWriteClient(config));
  const logger = overrides.logger ?? createJsonLogger();
  const clock = overrides.clock ?? systemClock;
  const ids = overrides.ids ?? cryptoIdGenerator;

  const presets = createPresetResolver({
    store,
    logger,
    ttlMs: config.presetCacheTtlMs,
    now: () => clock.now().getTime(),
  });
  const urls = createImageUrls({
    projectId: config.projectId,
    dataset: config.dataset,
  });

  async function requireImage(id: string) {
    const image = await store.findImage(id);
    if (!image)
      throw new AssetLakeError(
        "IMAGE_NOT_FOUND",
        `Image ${id} does not exist.`,
      );
    return image;
  }

  return {
    images: {
      upload: createUploadImage({ store, logger, clock, ids }),
      delete: createDeleteImage({ store, logger }),

      async findLatestForEntity(query: {
        entity: EntityRef;
        purpose: ImagePurpose;
      }): Promise<AssetLakeImageResult | null> {
        const image = await store.findLatestReadyImage(query);
        return image
          ? normalizeImage(image.id, toResultStatus(image.status), image.asset)
          : null;
      },

      countUploadsSince: ({
        applicationId,
        since,
      }: {
        applicationId: string;
        since: Date;
      }) =>
        store.countImagesSince({ applicationId, since: since.toISOString() }),

      countUploadsForEntity: (entity: EntityRef) =>
        store.countImagesForEntity(entity),

      async url(
        imageId: string,
        { preset }: { preset: string },
      ): Promise<string> {
        const [image, transform] = await Promise.all([
          requireImage(imageId),
          presets.get(preset),
        ]);
        return urls.buildUrl(image.source, transform);
      },

      async responsive(
        imageId: string,
        options: { preset: string; sizes?: string },
      ): Promise<ResponsiveImage> {
        const [image, transform] = await Promise.all([
          requireImage(imageId),
          presets.get(options.preset),
        ]);
        return urls.buildResponsive(image.source, transform, {
          sizes: options.sizes,
          lqip: image.asset.lqip,
          dimensions: { width: image.asset.width, height: image.asset.height },
        });
      },

      buildUrl: urls.buildUrl,
      buildResponsive: urls.buildResponsive,
    },
    presets: {
      get: presets.get,
      list: presets.list,
    },
    setup: {
      ensure: (
        plan: SetupPlan,
        { mode = "create-if-missing" }: { mode?: SetupMode } = {},
      ) => store.ensureSetup(plan, mode),
      missing: (plan: SetupPlan) => store.findMissingSetup(plan),
    },
  };
}

export type AssetLake = ReturnType<typeof createAssetLake>;
