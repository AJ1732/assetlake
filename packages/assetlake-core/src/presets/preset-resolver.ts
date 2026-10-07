import type { ImageTransform } from "../contracts";
import { imageTransformSchema } from "../delivery/transform";
import { AssetLakeError } from "../errors/asset-lake-error";
import type { Logger } from "../logging/logger";
import type { AssetLakeStore, PresetRecord } from "../store/asset-lake-store";
import { TtlCache } from "./ttl-cache";

export interface NamedTransform {
  slug: string;
  name: string;
  transform: ImageTransform;
}

const withoutNulls = (record: PresetRecord) =>
  Object.fromEntries(
    Object.entries({
      width: record.width,
      height: record.height,
      quality: record.quality,
      fit: record.fit,
      crop: record.crop,
      autoFormat: record.autoFormat,
    }).filter(([, value]) => value !== null && value !== undefined),
  );

export function toTransform(
  record: PresetRecord,
  logger: Logger,
): ImageTransform {
  const parsed = imageTransformSchema.safeParse(withoutNulls(record));
  if (!parsed.success) {
    logger.log("error", "PRESET_INVALID", {
      slug: record.slug,
      fields: parsed.error.issues.map((issue) => issue.path.join(".")),
    });
    throw new AssetLakeError(
      "PRESET_INVALID",
      `Preset ${record.slug} has invalid transform values.`,
    );
  }
  return parsed.data;
}

// Unknown slugs are remembered briefly so a caller passing request input (the Express example's
// ?preset=) can't turn every request into a Sanity read, while a newly published preset still
// shows up within seconds.
const UNKNOWN_PRESET_TTL_MS = 5_000;

/**
 * Presets live in Sanity so they can change without a redeploy. An in-process TTL (default 60s)
 * bounds both Sanity reads and how long an edited preset takes to apply.
 */
export function createPresetResolver({
  store,
  logger,
  ttlMs,
  now,
}: {
  store: AssetLakeStore;
  logger: Logger;
  ttlMs: number;
  now: () => number;
}) {
  const cache = new TtlCache<ImageTransform | null>(
    (transform) => (transform ? ttlMs : Math.min(ttlMs, UNKNOWN_PRESET_TTL_MS)),
    now,
  );

  async function loadTransform(slug: string): Promise<ImageTransform | null> {
    const record = await store.findPresetBySlug(slug);
    return record ? toTransform(record, logger) : null;
  }

  return {
    async get(slug: string): Promise<ImageTransform> {
      const transform = await cache.getOrLoad(slug, () => loadTransform(slug));
      if (!transform) {
        logger.log("warn", "PRESET_NOT_FOUND", { slug });
        throw new AssetLakeError(
          "PRESET_NOT_FOUND",
          `Unknown preset "${slug}".`,
        );
      }
      return transform;
    },

    async list(): Promise<NamedTransform[]> {
      const records = await store.listPresets();
      const named = records.map((record) => ({
        slug: record.slug,
        name: record.name,
        transform: toTransform(record, logger),
      }));
      for (const { slug, transform } of named) cache.set(slug, transform);
      return named;
    },
  };
}

export type PresetResolver = ReturnType<typeof createPresetResolver>;
