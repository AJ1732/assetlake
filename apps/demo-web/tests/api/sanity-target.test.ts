import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { stubServerEnvironment, TEST_TOKEN } from "./support/fixtures";

// sanity-target.ts imports env.ts, which parses process.env at import.
const loadModules = async () => ({
  ...(await import("@/lib/server/env")),
  ...(await import("@/lib/server/sanity-target")),
});

describe("public Sanity target", () => {
  beforeAll(() => stubServerEnvironment({ SANITY_PROJECT_ID: "abc123" }));
  afterAll(() => vi.unstubAllEnvs());

  it("carries the configured project and dataset", async () => {
    const { getPublicSanityTarget } = await loadModules();
    expect(getPublicSanityTarget()).toEqual({
      projectId: "abc123",
      dataset: "test",
    });
  });

  it("holds exactly projectId and dataset, so no secret can reach a client prop", async () => {
    const { parseServerEnvironment, toPublicSanityTarget } =
      await loadModules();
    const target = toPublicSanityTarget(parseServerEnvironment(process.env));

    expect(Object.keys(target).sort()).toEqual(["dataset", "projectId"]);
    expect(JSON.stringify(target)).not.toContain(TEST_TOKEN);
  });
});
