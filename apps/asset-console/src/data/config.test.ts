import { describe, expect, it } from "vitest";

import { isProductionDataset, resolveDataset } from "./config";

describe("resolveDataset", () => {
  it.each([undefined, "", "   "])("falls back to production for %j", (raw) => {
    expect(resolveDataset(raw)).toBe("production");
  });

  it("uses an explicit dataset", () => {
    expect(resolveDataset("test")).toBe("test");
  });

  it("trims surrounding whitespace", () => {
    expect(resolveDataset("  test\n")).toBe("test");
  });
});

describe("isProductionDataset", () => {
  it("flags production only", () => {
    expect(isProductionDataset("production")).toBe(true);
    expect(isProductionDataset("test")).toBe(false);
  });
});
