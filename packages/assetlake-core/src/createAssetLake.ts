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
import { createImageUrls } from "./delivery/imageUrls";
import { AssetLakeError } from "./errors/AssetLakeError";
import { createDeleteImage } from "./images/deleteImage";
import { cryptoIdGenerator, type IdGenerator } from "./images/imageId";
import { normalizeImage, toResultStatus } from "./images/normalize";
import { type Clock, createUploadImage } from "./images/uploadImage";
import { createJsonLogger, type Logger } from "./logging/logger";
import { createPresetResolver } from "./presets/presetResolver";
import type { AssetLakeStore } from "./store/AssetLakeStore";
import {
  createSanityStore,
  createSanityWriteClient,
} from "./store/sanityStore";

export interface AssetLakeOverrides {
  store?: AssetLakeStore;
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
  };
}

export type AssetLake = ReturnType<typeof createAssetLake>;
