import type { ImageRow } from "./types";

export interface ImageFilters {
  applicationId: string | null;
  purpose: string | null;
  status: string | null;
}

export const NO_FILTERS: ImageFilters = {
  applicationId: null,
  purpose: null,
  status: null,
};

export interface ApplicationOption {
  id: string;
  name: string;
}

const matches = (wanted: string | null, actual: string | null | undefined) =>
  wanted === null || wanted === actual;

export function filterImages(
  rows: readonly ImageRow[],
  filters: ImageFilters,
): ImageRow[] {
  return rows.filter(
    (row) =>
      matches(filters.applicationId, row.application?.id) &&
      matches(filters.purpose, row.purpose) &&
      matches(filters.status, row.status),
  );
}

export const hasActiveFilters = (filters: ImageFilters) =>
  Object.values(filters).some((value) => value !== null);

/** Applications that actually appear in the data, deduplicated and sorted by name. */
export function applicationOptions(
  rows: readonly ImageRow[],
): ApplicationOption[] {
  const byId = new Map<string, ApplicationOption>();
  for (const { application } of rows) {
    if (application && !byId.has(application.id))
      byId.set(application.id, {
        id: application.id,
        name: application.name || application.id,
      });
  }
  return [...byId.values()].toSorted((a, b) => a.name.localeCompare(b.name));
}
