import { describe, expect, it } from "vitest";

import {
  isLive,
  readRegistry,
  registryUrl,
  releaseCommands,
  releaseProblems,
  type ReleaseState,
} from "./release-plan";

const READY: ReleaseState = {
  name: "@assetlake/core",
  version: "0.3.1",
  branch: "dev",
  clean: true,
  headIsPushed: true,
  tagExists: false,
  publishedVersions: ["0.2.0", "0.3.0"],
};

describe("releaseProblems", () => {
  it("finds none when the tree is clean, pushed, untagged and the version is new", () => {
    expect(releaseProblems(READY)).toEqual([]);
  });

  it.each([
    [{ clean: false }, /uncommitted changes/],
    [{ headIsPushed: false }, /origin\/dev/],
    [
      { publishedVersions: ["0.3.1"] },
      /@assetlake\/core@0\.3\.1 is already on npm/,
    ],
    [{ tagExists: true }, /tag @assetlake\/core@0\.3\.1 already exists/],
    [{ branch: null }, /detached/],
  ] satisfies [Partial<ReleaseState>, RegExp][])(
    "blocks on %o",
    (change, message) => {
      const problems = releaseProblems({ ...READY, ...change });

      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(message);
    },
  );

  it("reports every problem at once", () => {
    expect(
      releaseProblems({ ...READY, clean: false, tagExists: true }),
    ).toHaveLength(2);
  });
});

describe("releaseCommands", () => {
  it("publishes, then tags, then pushes only that tag", () => {
    expect(releaseCommands(READY)).toEqual([
      "pnpm --filter @assetlake/core publish --access public --publish-branch dev",
      'git tag -a @assetlake/core@0.3.1 -m "@assetlake/core 0.3.1"',
      "git push origin @assetlake/core@0.3.1",
    ]);
  });

  it("drops --publish-branch on main, which pnpm publishes from by default", () => {
    expect(releaseCommands({ ...READY, branch: "main" })[0]).toBe(
      "pnpm --filter @assetlake/core publish --access public",
    );
  });

  it("refuses a detached HEAD", () => {
    expect(() => releaseCommands({ ...READY, branch: null })).toThrow(/branch/);
  });
});

describe("readRegistry", () => {
  it("reads latest and every version from the package document", () => {
    expect(
      readRegistry({
        "dist-tags": { latest: "0.3.0" },
        versions: { "0.0.0-stage": {}, "0.2.0": {}, "0.3.0": {} },
      }),
    ).toEqual({ latest: "0.3.0", versions: ["0.0.0-stage", "0.2.0", "0.3.0"] });
  });

  it.each([{ error: "Not found" }, null, "Not found"])(
    "treats %o as never published",
    (document) => {
      expect(readRegistry(document)).toEqual({
        latest: undefined,
        versions: [],
      });
    },
  );
});

describe("isLive", () => {
  it("waits while npm still serves the previous latest (staged publish)", () => {
    expect(isLive({ latest: "0.3.0", versions: ["0.3.0"] }, "0.3.1")).toBe(
      false,
    );
  });

  it("is live once latest is the released version", () => {
    expect(
      isLive({ latest: "0.3.1", versions: ["0.3.0", "0.3.1"] }, "0.3.1"),
    ).toBe(true);
  });
});

describe("registryUrl", () => {
  it("escapes the scope slash the way the registry expects", () => {
    expect(registryUrl("@assetlake/core")).toBe(
      "https://registry.npmjs.org/@assetlake%2fcore",
    );
  });
});
