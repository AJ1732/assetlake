import { describe, expect, it, vi } from "vitest";

import { memoizeByTarget } from "./memoize-by-target";

const DEMO = { projectId: "oshzwvjy", dataset: "production" };

describe("memoizeByTarget", () => {
  it("creates once per project and dataset", () => {
    const create = vi.fn((target: typeof DEMO) => ({ ...target }));
    const get = memoizeByTarget(create);

    expect(get({ ...DEMO })).toBe(get({ ...DEMO }));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each([
    { projectId: "abc123", dataset: "production" },
    { projectId: "oshzwvjy", dataset: "test" },
  ])("never reuses an instance for %o", (other) => {
    const get = memoizeByTarget((target) => ({ ...target }));

    expect(get(other)).not.toBe(get(DEMO));
    expect(get(other)).toEqual(other);
  });
});
