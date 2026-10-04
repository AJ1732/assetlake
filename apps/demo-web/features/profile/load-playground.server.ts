import "server-only";

import type {
  AssetLakeImageResult,
  ImageTransform,
  ResponsiveImage,
} from "@assetlake/core";

import { getAssetLake } from "@/lib/server/asset-lake";
import type { DemoSession } from "@/lib/server/session";

import { orderPresets } from "../presets/preset-order";

export const AVATAR_PRESET = "avatar";
const AVATAR_SIZES = "128px";
const MATRIX_SIZES = "(max-width: 640px) 100vw, 320px";

export type PresetCell =
  | {
      status: "ready";
      slug: string;
      name: string;
      transform: ImageTransform;
      url: string;
      image: ResponsiveImage;
    }
  | { status: "error"; slug: string; name: string; message: string };

export interface PlaygroundData {
  avatar: { record: AssetLakeImageResult; image: ResponsiveImage } | null;
  presets: PresetCell[];
  presetsError: string | null;
}

const PRESET_CELL_FAILED = "This preset could not be resolved.";
const PRESET_LIST_FAILED = "Presets could not be loaded from Sanity.";

/**
 * Every URL comes from core, which reads the stored image (with its hotspot and crop) and the
 * preset from Sanity. The page never builds a transform URL from an asset id.
 */
export async function loadPlayground(
  session: DemoSession,
): Promise<PlaygroundData> {
  const assetLake = getAssetLake();
  const record = await assetLake.images.findLatestForEntity({
    entity: { type: "user", id: session.userId },
    purpose: "avatar",
  });
  if (!record) return { avatar: null, presets: [], presetsError: null };

  const [avatarImage, presetList] = await Promise.all([
    assetLake.images.responsive(record.id, {
      preset: AVATAR_PRESET,
      sizes: AVATAR_SIZES,
    }),
    assetLake.presets.list().catch(() => null),
  ]);
  const avatar = { record, image: avatarImage };
  if (!presetList)
    return { avatar, presets: [], presetsError: PRESET_LIST_FAILED };

  const presets = await Promise.all(
    orderPresets(presetList).map(
      async ({ slug, name, transform }): Promise<PresetCell> => {
        try {
          const [url, image] = await Promise.all([
            assetLake.images.url(record.id, { preset: slug }),
            assetLake.images.responsive(record.id, {
              preset: slug,
              sizes: MATRIX_SIZES,
            }),
          ]);
          return { status: "ready", slug, name, transform, url, image };
        } catch {
          return { status: "error", slug, name, message: PRESET_CELL_FAILED };
        }
      },
    ),
  );
  return { avatar, presets, presetsError: null };
}
