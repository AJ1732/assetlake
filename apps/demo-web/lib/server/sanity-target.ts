import "server-only";

import type { SanityProject } from "@assetlake/sanity-schema/project";

import {
  type ServerEnv as ServerEnvironment,
  serverEnv as serverEnvironment,
} from "./env";

// The only server values a page may hand to client components. Built field by field, never by
// spreading, so the environment object (and the write token in it) can't leak into a prop.
export function toPublicSanityTarget(
  environment: ServerEnvironment,
): SanityProject {
  return {
    projectId: environment.SANITY_PROJECT_ID,
    dataset: environment.SANITY_DATASET,
  };
}

export const getPublicSanityTarget = () =>
  toPublicSanityTarget(serverEnvironment);
