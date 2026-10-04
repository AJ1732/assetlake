import { useQuery } from "@sanity/sdk-react";

import { toPresetVariant } from "../data/preset-transform";
import { PRESETS_QUERY } from "../data/queries";
import type { PresetRow } from "../data/types";

/** "drafts" shows unpublished preset edits; "published" is what @assetlake/core delivers. */
export type PresetPerspective = "drafts" | "published";

export function usePresetRows(perspective: PresetPerspective): PresetRow[] {
  const { data } = useQuery<PresetRow[] | null>({
    query: PRESETS_QUERY,
    perspective,
  });
  return data ?? [];
}

export function usePresetVariants(perspective: PresetPerspective = "drafts") {
  return usePresetRows(perspective).map(toPresetVariant);
}
