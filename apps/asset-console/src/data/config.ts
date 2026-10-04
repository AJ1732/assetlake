import { DEFAULT_DATASET } from "@assetlake/sanity-schema/project";

/** SANITY_APP_DATASET picks a dataset per dev run; anything blank falls back to production. */
export function resolveDataset(raw: string | undefined): string {
  const dataset = raw?.trim();
  return dataset || DEFAULT_DATASET;
}

export const isProductionDataset = (dataset: string) =>
  dataset === DEFAULT_DATASET;
