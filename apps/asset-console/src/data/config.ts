import {
  DEFAULT_DATASET,
  type EnvironmentSource,
  resolveSanityProject,
  type SanityProject,
} from "@assetlake/sanity-schema/project";

/** SANITY_APP_* reach the browser bundle (Vite envPrefix); anything blank falls back to the demo. */
export function resolveConsoleTarget(source: EnvironmentSource): SanityProject {
  return resolveSanityProject(source, {
    projectId: "SANITY_APP_PROJECT_ID",
    dataset: "SANITY_APP_DATASET",
  });
}

export const isProductionDataset = (dataset: string) =>
  dataset === DEFAULT_DATASET;

export interface ConsoleDeployment {
  organizationId: string;
  appId?: string;
}

const DEMO_DEPLOYMENT = {
  organizationId: "o5eRlVKEZ",
  // Written from the first `sanity deploy --create --json` (2026-10-04). Never invent this id.
  appId: "otc94a70i1qncgk3i3hmzosp",
} as const satisfies ConsoleDeployment;

// CLI-only names (no SANITY_APP_ prefix), so they never reach the bundle. A fork sets its own
// organization and leaves the app id unset until `sanity deploy --create` prints one.
export function resolveConsoleDeployment(
  source: EnvironmentSource,
): ConsoleDeployment {
  const organizationId = source.ASSETLAKE_CONSOLE_ORGANIZATION_ID?.trim();
  const appId = source.ASSETLAKE_CONSOLE_APP_ID?.trim() || undefined;
  if (!organizationId) {
    if (appId) {
      throw new Error(
        "ASSETLAKE_CONSOLE_APP_ID needs ASSETLAKE_CONSOLE_ORGANIZATION_ID: an app id belongs to one organization.",
      );
    }
    return DEMO_DEPLOYMENT;
  }
  return { organizationId, appId };
}
