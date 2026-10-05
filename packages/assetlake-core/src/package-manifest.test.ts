import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  exports: Record<string, string>;
  publishConfig: {
    exports: Record<string, { types: string; default: string }>;
  };
};

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageManifest;

// In the repo, exports point at src so the apps and vitest need no build. pnpm swaps in
// publishConfig.exports when packing, so a subpath missing there would not exist on npm.
describe("@assetlake/core publish manifest", () => {
  it("publishes every source subpath from its built dist file", () => {
    const expected = Object.fromEntries(
      Object.entries(manifest.exports).map(([subpath, source]) => {
        const name = source.replace(/^\.\/src\/(.+)\.ts$/, "$1");
        return [
          subpath,
          { types: `./dist/${name}.d.ts`, default: `./dist/${name}.js` },
        ];
      }),
    );

    expect(manifest.publishConfig.exports).toEqual(expected);
  });
});
