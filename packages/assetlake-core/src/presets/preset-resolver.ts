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

/**
 * Presets live in Sanity so they can change without a redeploy. A short in-process TTL (default
 * 60s, handoff §13.3) bounds both Sanity reads and how long an edited preset takes to apply.
 */
export function createPresetResolver(dependencies: {
  store: AssetLakeStore;
  logger: Logger;
  ttlMs: number;
  now: () => number;
}) {
  const cache = new TtlCache<ImageTransform>(
    dependencies.ttlMs,
    dependencies.now,
  );

  return {
    async get(slug: string): Promise<ImageTransform> {
      const cached = cache.get(slug);
      if (cached) return cached;

      const record = await dependencies.store.findPresetBySlug(slug);
      if (!record) {
        dependencies.logger.log("warn", "PRESET_NOT_FOUND", { slug });
        throw new AssetLakeError(
          "PRESET_NOT_FOUND",
          `Unknown preset "${slug}".`,
        );
      }
      const transform = toTransform(record, dependencies.logger);
      cache.set(slug, transform);
      return transform;
    },

    async list(): Promise<NamedTransform[]> {
      const records = await dependencies.store.listPresets();
      return records.map((record) => ({
        slug: record.slug,
        name: record.name,
        transform: toTransform(record, dependencies.logger),
      }));
    },
  };
}

export type PresetResolver = ReturnType<typeof createPresetResolver>;
