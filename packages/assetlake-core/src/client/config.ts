import { z } from "zod";

import {
  SANITY_DATASET_PATTERN,
  SANITY_PROJECT_ID_PATTERN,
} from "../constants";

// A hostname with at least one dot, optionally behind "*." for its subdomains. No scheme or path.
const HOST_PATTERN = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export const assetLakeConfigSchema = z.object({
  projectId: z
    .string()
    .regex(SANITY_PROJECT_ID_PATTERN, "projectId must be a Sanity project id"),
  dataset: z
    .string()
    .regex(
      SANITY_DATASET_PATTERN,
      "dataset must be a valid Sanity dataset name",
    ),
  apiVersion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "apiVersion must be YYYY-MM-DD"),
  token: z.string().min(1, "token is required for uploads and mutations"),
  presetCacheTtlMs: z.number().int().nonnegative().default(60_000),
  // images.uploadFromUrl is off unless hosts are listed here: whoever controls the URL decides
  // what Sanity fetches into the dataset.
  remoteUploads: z
    .object({
      allowedHosts: z.array(
        z.string().toLowerCase().regex(HOST_PATTERN, "allowed host pattern"),
      ),
    })
    .optional(),
  // images.transitionStatus refuses every reviewer not listed here, and everyone when it is absent.
  review: z
    .object({
      reviewerIds: z.array(z.string().trim().min(1, "reviewer id")),
    })
    .optional(),
});

export type AssetLakeConfigInput = z.input<typeof assetLakeConfigSchema>;
export type AssetLakeConfig = z.output<typeof assetLakeConfigSchema>;

// Error message lists failing fields only; it never echoes values (the token is one of them).
export function parseAssetLakeConfig(input: unknown): AssetLakeConfig {
  const parsed = assetLakeConfigSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.issues.map(
      (issue) => issue.path.join(".") || "(root)",
    );
    throw new Error(
      `Invalid AssetLake config: ${[...new Set(fields)].join(", ")}`,
    );
  }
  return parsed.data;
}
