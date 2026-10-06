import { DOCUMENT_TYPES } from "@assetlake/core/contracts";

// The Function filters, shared by sanity.blueprint.ts and the gate tests that pin them.

/**
 * Wakes the drainer only when unclaimed effects increase. Claiming or completing an effect never
 * raises the count, so the drainer's own writes can't wake it again.
 */
export const drainTriggerFilter = (tag: string) =>
  [
    `_type == "sanity.workflow.instance"`,
    `tag == "${tag}"`,
    `count(after().pendingEffects[!defined(claim)]) > coalesce(count(before().pendingEffects[!defined(claim)]), 0)`,
  ].join(" && ");

/** Paired with `on: ["create"]`: the drainer's status patch is an update, so it never restarts. */
export const START_TRIGGER = {
  on: ["create"],
  filter: `_type == "${DOCUMENT_TYPES.image}" && status == "review"`,
  projection: "{_id, status}",
} as const;
