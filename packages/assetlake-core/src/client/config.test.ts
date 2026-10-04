import { describe, expect, it } from "vitest";

import { parseAssetLakeConfig } from "./config";

const valid = {
  projectId: "oshzwvjy",
  dataset: "production",
  apiVersion: "2026-10-04",
  token: "sk-secret-value",
};

describe("parseAssetLakeConfig", () => {
  it("accepts a valid config and defaults the preset TTL to 60s", () => {
    expect(parseAssetLakeConfig(valid)).toEqual({
      ...valid,
      presetCacheTtlMs: 60_000,
    });
  });

  it.each([
    [{ token: "" }, "token"],
    [{ dataset: "Prod" }, "dataset"],
    [{ apiVersion: "v1" }, "apiVersion"],
    [{ projectId: "has space" }, "projectId"],
  ])("rejects %o naming the field", (override, field) => {
    expect(() => parseAssetLakeConfig({ ...valid, ...override })).toThrow(
      field,
    );
  });

  it("never echoes the token in the error", () => {
    expect(() => parseAssetLakeConfig({ ...valid, dataset: "Bad" })).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("sk-secret-value"),
      }),
    );
  });
});
