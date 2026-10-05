import { describe, expect, it } from "vitest";

import { UsageError } from "../cli-errors";
import { createTestLake } from "../test-support";
import { init } from "./init";

const STARTER_IDS = [
  "assetlake-policy-public-images",
  "assetlake-preset-avatar-sm",
  "assetlake-preset-avatar",
  "assetlake-preset-card",
  "assetlake-preset-hero",
  "assetlake-application-my-app",
];
const defaults = { slug: "my-app", reset: false };

describe("init", () => {
  it("creates the starter policy, presets and application", async () => {
    const { assetLake } = createTestLake();

    await expect(init({ assetLake }, defaults)).resolves.toEqual({
      exitCode: 0,
      output: {
        event: "INIT_COMPLETED",
        mode: "create-if-missing",
        applicationId: "assetlake-application-my-app",
        presets: ["avatar-sm", "avatar", "card", "hero"],
        created: STARTER_IDS,
        existing: [],
      },
    });
  });

  it("creates nothing on a second run", async () => {
    const { assetLake } = createTestLake();
    await init({ assetLake }, defaults);

    const rerun = await init({ assetLake }, defaults);

    expect(rerun.output).toMatchObject({ created: [], existing: STARTER_IDS });
  });

  it("reports the documents it replaced in reset mode", async () => {
    const { assetLake } = createTestLake();
    await init({ assetLake }, defaults);

    const reset = await init({ assetLake }, { ...defaults, reset: true });

    expect(reset.output).toEqual({
      event: "INIT_COMPLETED",
      mode: "reset",
      applicationId: "assetlake-application-my-app",
      presets: ["avatar-sm", "avatar", "card", "hero"],
      created: [],
      replaced: STARTER_IDS,
    });
  });

  it.each([
    ["slug", { slug: "My App" }, "applicationSlug"],
    ["environment", { environment: "prod" }, "environment"],
  ])("rejects an invalid %s as a usage error", async (_label, input, field) => {
    const { assetLake } = createTestLake();

    const attempt = init({ assetLake }, { ...defaults, ...input });

    await expect(attempt).rejects.toBeInstanceOf(UsageError);
    await expect(attempt).rejects.toThrow(field);
  });
});
