import type { SetupPlan } from "../setup/setup-plan";

// "create-if-missing" is the default so rerunning init or the seed never reverts preset edits made
// in the console; "reset" restores the plan's values on purpose.
export type SetupMode = "create-if-missing" | "reset";

/** In "reset" mode the existing documents were replaced; otherwise they were left untouched. */
export interface SetupResult {
  created: string[];
  existing: string[];
}

// Separate from AssetLakeStore (interface segregation): upload and delivery never write setup
// documents, and setup never touches images.
export interface SetupStore {
  ensureSetup(plan: SetupPlan, mode: SetupMode): Promise<SetupResult>;
  /** Ids from the plan that have no document yet. */
  findMissingSetup(plan: SetupPlan): Promise<string[]>;
}

export function toSetupResult(
  ids: readonly string[],
  missing: ReadonlySet<string>,
): SetupResult {
  return {
    created: ids.filter((id) => missing.has(id)),
    existing: ids.filter((id) => !missing.has(id)),
  };
}
