import { parseAssetLakeConfig } from "@assetlake/core";

import { UsageError } from "./cli-errors";

export type CliEnvironment = Readonly<Record<string, string | undefined>>;

export interface CliTarget {
  projectId: string;
  dataset: string;
  apiVersion: string;
  token: string;
}

const DEFAULT_DATASET = "production";
const API_VERSION = "2026-10-04";
const TOKEN_VARIABLES = ["ASSETLAKE_TOKEN", "SANITY_AUTH_TOKEN"] as const;

// The token only ever comes from the environment: a flag would land in shell history and in the
// process list. Errors name variables and fields, never values.
export function resolveTarget(
  flags: { project?: string; dataset?: string },
  environment: CliEnvironment,
): CliTarget {
  const token = TOKEN_VARIABLES.map((name) => environment[name]).find(Boolean);
  if (!token) {
    throw new UsageError(
      "No token. Set ASSETLAKE_TOKEN (or SANITY_AUTH_TOKEN) to a Sanity token with the Editor role.",
    );
  }

  const projectId = flags.project ?? environment.ASSETLAKE_PROJECT_ID;
  if (!projectId) {
    throw new UsageError(
      "No project. Pass --project <id> or set ASSETLAKE_PROJECT_ID.",
    );
  }

  const target = {
    projectId,
    dataset: flags.dataset ?? environment.ASSETLAKE_DATASET ?? DEFAULT_DATASET,
    apiVersion: API_VERSION,
    token,
  };
  try {
    parseAssetLakeConfig(target);
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
  return target;
}

/** Values to scrub from anything printed, in case an upstream error ever echoes one. */
export function secretValues(environment: CliEnvironment): string[] {
  return TOKEN_VARIABLES.map((name) => environment[name]).filter(
    (value): value is string => Boolean(value),
  );
}
