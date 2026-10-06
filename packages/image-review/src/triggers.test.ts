import { describe, expect, it } from "vitest";

import { drainTriggerFilter, START_TRIGGER } from "./triggers";

describe("Function triggers", () => {
  it("wakes the drainer only for this tag's instances when unclaimed effects increase", () => {
    const filter = drainTriggerFilter("production");

    expect(filter).toContain('_type == "sanity.workflow.instance"');
    expect(filter).toContain('tag == "production"');
    expect(filter).toContain(
      "count(after().pendingEffects[!defined(claim)]) > coalesce(count(before().pendingEffects[!defined(claim)]), 0)",
    );
  });

  // The drainer patches status on an existing record; an update trigger would restart reviews.
  it("starts reviews on create only, for images held in review", () => {
    expect(START_TRIGGER.on).toEqual(["create"]);
    expect(START_TRIGGER.filter).toBe(
      '_type == "assetLakeImage" && status == "review"',
    );
  });
});
