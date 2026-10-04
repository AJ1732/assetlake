import { DEFAULT_API_VERSION, DEFAULT_DATASET } from "../project.ts";

export type SeedMode = "create-if-missing" | "reset";

export interface SeedConfig {
  dataset: string;
  apiVersion: string;
  token: string;
  mode: SeedMode;
}

// Sanity dataset naming rule: 1-64 chars, a-z 0-9 - _, starts and ends with a letter or digit.
const DATASET_NAME = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

export function readSeedConfig(
  environment: NodeJS.ProcessEnv,
  argv: readonly string[],
): SeedConfig {
  const token = environment.SANITY_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "Missing SANITY_WRITE_TOKEN (Editor robot token). Set it in the root .env.local.",
    );
  }

  const dataset = environment.SANITY_DATASET ?? DEFAULT_DATASET;
  if (!DATASET_NAME.test(dataset)) {
    throw new Error(`Invalid SANITY_DATASET "${dataset}"`);
  }

  return {
    dataset,
    apiVersion: environment.SANITY_API_VERSION ?? DEFAULT_API_VERSION,
    token,
    mode: argv.includes("--reset") ? "reset" : "create-if-missing",
  };
}
