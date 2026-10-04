import { useQuery } from "@sanity/sdk-react";

import { IMAGE_LIST_QUERY } from "../data/queries";
import type { ImageListResult } from "../data/types";

const EMPTY_LIST: ImageListResult = { total: 0, items: [] };

/**
 * Live via the Live Content API: a new upload re-renders every subscriber with no polling.
 * Raw GROQ on purpose: Overview needs counts and byte sums across all records in one result.
 */
export function useImageList(): ImageListResult {
  const { data } = useQuery<ImageListResult | null>({
    query: IMAGE_LIST_QUERY,
  });
  return data ?? EMPTY_LIST;
}
