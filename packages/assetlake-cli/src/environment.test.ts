import { describe, expect, it } from "vitest";

import { UsageError } from "./cli-errors";
import { resolveTarget } from "./environment";

const TOKEN = "sk-cli-test-token-must-never-leak";
const base = { ASSETLAKE_TOKEN: TOKEN, ASSETLAKE_PROJECT_ID: "abc123" };

function failure(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected resolveTarget to throw");
}

describe("resolveTarget", () => {
  it("reads the token and project from the environment and defaults the dataset", () => {
    expect(resolveTarget({}, base)).toEqual({
      projectId: "abc123",
      dataset: "production",
      apiVersion: "2026-10-04",
      token: TOKEN,
    });
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
  ])(
    "falls back to SANITY_AUTH_TOKEN when ASSETLAKE_TOKEN is %s",
    (_label, value) => {
      const target = resolveTarget(
        {},
        { ...base, ASSETLAKE_TOKEN: value, SANITY_AUTH_TOKEN: "sk-fallback" },
      );
      expect(target.token).toBe("sk-fallback");
    },
  );

  it("prefers --project and --dataset over the environment", () => {
    const target = resolveTarget(
      { project: "flagproject", dataset: "staging" },
      { ...base, ASSETLAKE_DATASET: "test" },
    );
    expect(target).toMatchObject({
      projectId: "flagproject",
      dataset: "staging",
    });
  });

  it("uses ASSETLAKE_DATASET when no flag is given", () => {
    expect(
      resolveTarget({}, { ...base, ASSETLAKE_DATASET: "test" }).dataset,
    ).toBe("test");
  });

  it("names both token variables when no token is set", () => {
    const error = failure(() =>
      resolveTarget({}, { ASSETLAKE_PROJECT_ID: "abc123" }),
    );
    expect(error).toBeInstanceOf(UsageError);
    expect(error.message).toContain("ASSETLAKE_TOKEN");
    expect(error.message).toContain("SANITY_AUTH_TOKEN");
  });

  it("names the flag and the variable when no project is set", () => {
    const error = failure(() => resolveTarget({}, { ASSETLAKE_TOKEN: TOKEN }));
    expect(error).toBeInstanceOf(UsageError);
    expect(error.message).toContain("--project");
    expect(error.message).toContain("ASSETLAKE_PROJECT_ID");
  });

  it.each([
    ["project id", { project: "My Project" }, "projectId"],
    ["dataset name", { dataset: "Prod.Data" }, "dataset"],
  ])(
    "rejects an invalid %s by field name without echoing the token",
    (_label, flags, field) => {
      const error = failure(() => resolveTarget(flags, base));
      expect(error).toBeInstanceOf(UsageError);
      expect(error.message).toContain(field);
      expect(error.message).not.toContain(TOKEN);
    },
  );
});
