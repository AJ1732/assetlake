import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROOT } from "./support/pack-workspace";
import {
  readWorkspaceManifests,
  WORKSPACE_GROUPS,
} from "./support/workspace-manifests";

function workspaceGlobs(): string[] {
  const yaml = readFileSync(path.join(ROOT, "pnpm-workspace.yaml"), "utf8");
  const packagesBlock = /^packages:\n((?:[ \t]+-.*\n)+)/m.exec(yaml)?.[1] ?? "";
  return [...packagesBlock.matchAll(/-\s*["']?([^"'\s]+)/g)].map(
    ([, glob]) => glob!,
  );
}

describe("readWorkspaceManifests", () => {
  const manifests = readWorkspaceManifests();
  const files = manifests.map(({ file }) => file);

  it("starts with the root manifest", () => {
    expect(manifests[0]).toMatchObject({
      file: "package.json",
      manifest: { name: "assetlake", private: true },
    });
  });

  it("finds the publishable core package", () => {
    expect(
      manifests.find(({ manifest }) => manifest.name === "@assetlake/core"),
    ).toMatchObject({
      file: path.join("packages", "assetlake-core", "package.json"),
      manifest: { version: expect.stringMatching(/^\d+\.\d+\.\d+/) },
    });
  });

  it("walks exactly the groups pnpm-workspace.yaml declares", () => {
    const globs = workspaceGlobs();

    expect(globs.length).toBeGreaterThan(0);
    expect([...globs].sort()).toEqual(
      WORKSPACE_GROUPS.map((group) => `${group}/*`).sort(),
    );
  });

  it("includes every app and package", () => {
    for (const group of WORKSPACE_GROUPS)
      expect(files.filter((file) => file.startsWith(`${group}/`))).not.toEqual(
        [],
      );
  });
});
