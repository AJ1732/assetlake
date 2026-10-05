import { describe, expect, it } from "vitest";

import {
  isProductionDataset,
  resolveConsoleDeployment,
  resolveConsoleTarget,
} from "./config";

describe("resolveConsoleTarget", () => {
  it.each([undefined, "", "   "])(
    "falls back to the demo project and production for %j",
    (raw) => {
      expect(
        resolveConsoleTarget({
          SANITY_APP_PROJECT_ID: raw,
          SANITY_APP_DATASET: raw,
        }),
      ).toEqual({ projectId: "oshzwvjy", dataset: "production" });
    },
  );

  it("uses an explicit project and dataset", () => {
    expect(
      resolveConsoleTarget({
        SANITY_APP_PROJECT_ID: "abc123",
        SANITY_APP_DATASET: "test",
      }),
    ).toEqual({ projectId: "abc123", dataset: "test" });
  });

  it("trims surrounding whitespace", () => {
    const target = resolveConsoleTarget({ SANITY_APP_DATASET: "  test\n" });
    expect(target.dataset).toBe("test");
  });

  it("names an invalid variable", () => {
    expect(() =>
      resolveConsoleTarget({ SANITY_APP_PROJECT_ID: "Not An Id" }),
    ).toThrow("SANITY_APP_PROJECT_ID");
  });
});

describe("isProductionDataset", () => {
  it("flags production only", () => {
    expect(isProductionDataset("production")).toBe(true);
    expect(isProductionDataset("test")).toBe(false);
  });
});

describe("resolveConsoleDeployment", () => {
  it("deploys the demo console when nothing is set", () => {
    expect(resolveConsoleDeployment({})).toEqual({
      organizationId: "o5eRlVKEZ",
      appId: "otc94a70i1qncgk3i3hmzosp",
    });
  });

  it("never pairs a fork's organization with the demo app id", () => {
    expect(
      resolveConsoleDeployment({ ASSETLAKE_CONSOLE_ORGANIZATION_ID: "oFork" }),
    ).toEqual({ organizationId: "oFork", appId: undefined });
  });

  it("uses a fork's organization and app id", () => {
    expect(
      resolveConsoleDeployment({
        ASSETLAKE_CONSOLE_ORGANIZATION_ID: "oFork",
        ASSETLAKE_CONSOLE_APP_ID: "forkapp",
      }),
    ).toEqual({ organizationId: "oFork", appId: "forkapp" });
  });

  it("rejects an app id without its organization", () => {
    expect(() =>
      resolveConsoleDeployment({ ASSETLAKE_CONSOLE_APP_ID: "forkapp" }),
    ).toThrow("ASSETLAKE_CONSOLE_ORGANIZATION_ID");
  });
});
