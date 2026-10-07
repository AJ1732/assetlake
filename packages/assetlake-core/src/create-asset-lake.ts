import {
  type AssetLakeConfigInput,
  parseAssetLakeConfig,
} from "./client/config";
import { type Clock, systemClock } from "./clock";
import type { EntityRef } from "./contracts";
import { createImageDelivery } from "./delivery/image-delivery";
import { createImageUrls } from "./delivery/image-urls";
import { createDeleteImage } from "./images/delete-image";
import { cryptoIdGenerator, type IdGenerator } from "./images/image-id";
import { createTransitionStatus } from "./images/transition-status";
import { createUploadImageFromUrl } from "./images/upload-from-url";
import { createUploadImage } from "./images/upload-image";
import { createJsonLogger, type Logger } from "./logging/logger";
import { createPresetResolver } from "./presets/preset-resolver";
import type { SetupPlan } from "./setup/setup-plan";
import type { AssetLakeStore } from "./store/asset-lake-store";
import { createLazySanityStore } from "./store/lazy-sanity-store";
import type { SetupMode, SetupStore } from "./store/setup-store";

export interface AssetLakeOverrides {
  store?: AssetLakeStore & SetupStore;
  logger?: Logger;
  clock?: Clock;
  ids?: IdGenerator;
}

/** Server-only entry point (holds the write token). Browser code uses "@assetlake/core/url". */
export function createAssetLake(
  configInput: AssetLakeConfigInput,
  overrides: AssetLakeOverrides = {},
) {
  const config = parseAssetLakeConfig(configInput);
  const store = overrides.store ?? createLazySanityStore(config);
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

  const delivery = createImageDelivery({ store, presets, urls });
  const uploadDependencies = { store, logger, clock, ids };

  return {
    images: {
      upload: createUploadImage(uploadDependencies),
      uploadFromUrl: createUploadImageFromUrl(
        uploadDependencies,
        config.remoteUploads?.allowedHosts ?? [],
      ),
      delete: createDeleteImage({ store, logger }),
      transitionStatus: createTransitionStatus({
        store,
        logger,
        reviewerIds: config.review?.reviewerIds ?? [],
      }),

      findLatestForEntity: delivery.findLatestForEntity,

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

      url: delivery.url,
      responsive: delivery.responsive,
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
