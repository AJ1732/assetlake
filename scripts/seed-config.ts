import type { SetupMode } from "@assetlake/core";
import {
  DEFAULT_API_VERSION,
  resolveSanityProject,
  type SanityProject,
} from "@assetlake/sanity-schema/project";

export interface SeedConfig extends SanityProject {
  apiVersion: string;
  token: string;
  mode: SetupMode;
}

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

  return {
    ...resolveSanityProject(environment, {
      projectId: "SANITY_PROJECT_ID",
      dataset: "SANITY_DATASET",
    }),
    apiVersion: environment.SANITY_API_VERSION ?? DEFAULT_API_VERSION,
    token,
    mode: argv.includes("--reset") ? "reset" : "create-if-missing",
  };
}
