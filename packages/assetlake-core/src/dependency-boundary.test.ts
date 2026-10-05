import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Architecture lock §6.3: core stays framework-neutral. sanity-schema depends on core (for the
// constants), so a dependency back would be a workspace cycle and would put Studio in the npm package.
const FORBIDDEN_DEPENDENCY =
  /^(next|react|react-dom|express)$|^@next\/|^@sanity\/sdk-react$|^@assetlake\/sanity-schema$/;

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageManifest;

describe("@assetlake/core package boundary", () => {
  it("declares no framework, UI, HTTP-server, or Studio-schema dependency", () => {
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
