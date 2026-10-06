import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Workflows packages release together and 0.x minors can break, so every @sanity/workflow-*
// dependency in the workspace must name the same exact version (handoff §16.3).
const ROOT = path.resolve(import.meta.dirname, "..");
const WORKFLOW_PACKAGE = /^@sanity\/workflow-/;
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

type Manifest = Record<string, Record<string, string> | undefined>;

function workspaceManifests(): Array<{ file: string; manifest: Manifest }> {
  const files = ["apps", "packages"].flatMap((group) =>
    readdirSync(path.join(ROOT, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(group, entry.name, "package.json")),
  );
  return ["package.json", ...files].map((file) => ({
    file,
    manifest: JSON.parse(readFileSync(path.join(ROOT, file), "utf8")),
  }));
}

const workflowPins = workspaceManifests().flatMap(({ file, manifest }) =>
  ["dependencies", "devDependencies", "peerDependencies"].flatMap((field) =>
    Object.entries(manifest[field] ?? {})
      .filter(([name]) => WORKFLOW_PACKAGE.test(name))
      .map(([name, version]) => ({ file, name, version })),
  ),
);

describe("@sanity/workflow-* pins", () => {
  it("exist (the console and image-review both use Workflows)", () => {
    expect(workflowPins.length).toBeGreaterThan(0);
  });

  it("are exact versions, never ranges", () => {
    expect(
      workflowPins.filter(({ version }) => !EXACT_VERSION.test(version)),
    ).toEqual([]);
  });

  it("all name the same version", () => {
    expect(new Set(workflowPins.map(({ version }) => version)).size).toBe(1);
  });
});
