import { IMAGE_PURPOSES, IMAGE_STATUSES } from "@assetlake/core/contracts";

import type { ImageListResult, ImageRow } from "./types";

// Handoff §31 rule 11: this is a sum of original file sizes from asset documents. Sanity account
// usage is a billing metric and must never be implied by this number or its label.
export const ORIGINAL_BYTES_LABEL = "Original bytes of listed assets";

export const RECENT_UPLOADS_LIMIT = 8;
export const UNSET_KEY = "unset";

export interface Bucket {
  key: string;
  count: number;
}

export interface OverviewSummary {
  total: number;
  listed: number;
  byStatus: Bucket[];
  byPurpose: Bucket[];
  originalBytes: number;
  recent: ImageRow[];
}

/** Counts in `knownKeys` order (zeros kept so charts stay stable), then any unknown or unset keys. */
export function countBy<T>(
  rows: readonly T[],
  keyOf: (row: T) => string | null | undefined,
  knownKeys: readonly string[],
): Bucket[] {
  const counts = new Map<string, number>(knownKeys.map((key) => [key, 0]));
  for (const row of rows) {
    const key = keyOf(row) ?? UNSET_KEY;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => ({ key, count }));
}

export function sumOriginalBytes(rows: readonly ImageRow[]): number {
  let total = 0;
  for (const row of rows) {
    const size = row.asset?.size;
    if (typeof size === "number" && Number.isFinite(size) && size > 0)
      total += size;
  }
  return total;
}

const uploadedTime = (row: ImageRow) => {
  const time = row.uploadedAt ? Date.parse(row.uploadedAt) : Number.NaN;
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

export function recentUploads(
  rows: readonly ImageRow[],
  limit: number,
): ImageRow[] {
  return rows
    .toSorted((a, b) => uploadedTime(b) - uploadedTime(a))
    .slice(0, limit);
}

export function shareOfTotal(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

export function summarize(list: ImageListResult): OverviewSummary {
  return {
    total: list.total,
    listed: list.items.length,
    byStatus: countBy(list.items, (row) => row.status, IMAGE_STATUSES),
    byPurpose: countBy(list.items, (row) => row.purpose, IMAGE_PURPOSES),
    originalBytes: sumOriginalBytes(list.items),
    recent: recentUploads(list.items, RECENT_UPLOADS_LIMIT),
  };
}
