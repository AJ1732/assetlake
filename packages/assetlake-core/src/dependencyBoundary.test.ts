import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ASSETLAKE_CORE_PACKAGE } from "./index";

// Architecture lock §6.3: core stays framework-neutral.
const FORBIDDEN_DEPENDENCY =
  /^(next|react|react-dom|express)$|^@next\/|^@sanity\/sdk-react$/;

type PackageManifest = {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageManifest;

describe("@assetlake/core package boundary", () => {
  it("exposes its package name from the entry point", () => {
    expect(ASSETLAKE_CORE_PACKAGE).toBe(manifest.name);
  });

  it("declares no framework, UI, or HTTP-server dependency", () => {
    const declared = Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
    });

    expect(declared.filter((name) => FORBIDDEN_DEPENDENCY.test(name))).toEqual(
      [],
    );
  });
});
