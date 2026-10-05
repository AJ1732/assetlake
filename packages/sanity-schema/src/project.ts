import {
  SANITY_DATASET_PATTERN,
  SANITY_PROJECT_ID_PATTERN,
} from "@assetlake/core/contracts";

// Public by design: the challenge submission must disclose the project id. Tokens never live here.
// These are defaults only: each app, script and config resolves its own variables below.
export const DEFAULT_PROJECT_ID = "oshzwvjy";
export const DEFAULT_DATASET = "production";
export const DEFAULT_API_VERSION = "2026-10-04";

export interface SanityProject {
  projectId: string;
  dataset: string;
}

/** The variable each field is read from, so an error names the one to fix. */
export type SanityProjectVariables = Readonly<
  Record<keyof SanityProject, string>
>;

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const valueOrDefault = (value: string | undefined, fallback: string) =>
  value?.trim() || fallback;

// Blank counts as unset (an empty `KEY=` line in a .env file). Errors name variables, never values.
export function resolveSanityProject(
  source: EnvironmentSource,
  variables: SanityProjectVariables,
): SanityProject {
  const projectId = valueOrDefault(
    source[variables.projectId],
    DEFAULT_PROJECT_ID,
  );
  const dataset = valueOrDefault(source[variables.dataset], DEFAULT_DATASET);

  const invalid = [
    SANITY_PROJECT_ID_PATTERN.test(projectId) ? [] : [variables.projectId],
    SANITY_DATASET_PATTERN.test(dataset) ? [] : [variables.dataset],
  ].flat();
  if (invalid.length > 0) {
    throw new Error(`Invalid Sanity project settings: ${invalid.join(", ")}`);
  }
  return { projectId, dataset };
}
