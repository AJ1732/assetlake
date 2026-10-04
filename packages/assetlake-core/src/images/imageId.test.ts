import { describe, expect, it } from "vitest";

import { resolveImageIdentity } from "./imageId";

const ids = { randomId: () => "random-uuid" };

describe("resolveImageIdentity", () => {
  it("uses a random id when no idempotency key is given", () => {
    expect(resolveImageIdentity("user-demo-1", undefined, ids)).toEqual({
      id: "assetlake-image-random-uuid",
    });
  });

  it("derives the same id for the same actor and key", () => {
    const first = resolveImageIdentity("user-demo-1", "key-1", ids);
    expect(resolveImageIdentity("user-demo-1", "key-1", ids)).toEqual(first);
    expect(first.idempotencyKeyHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("scopes the key to the actor so two users cannot collide", () => {
    expect(resolveImageIdentity("user-demo-1", "key-1", ids).id).not.toBe(
      resolveImageIdentity("user-demo-2", "key-1", ids).id,
    );
  });

  it("never produces a dotted (private, tokenless-invisible) id within Sanity's 128-char limit", () => {
    const { id } = resolveImageIdentity("user-demo-1", "key-1", ids);
    expect(id).not.toContain(".");
    expect(id.length).toBeLessThanOrEqual(128);
  });
});
