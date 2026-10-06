import { describe, expect, it } from "vitest";

import { readWorkspaceManifests } from "./support/workspace-manifests";

// Workflows packages release together and 0.x minors can break, so every @sanity/workflow-*
// dependency in the workspace must name the same exact version.
const WORKFLOW_PACKAGE = /^@sanity\/workflow-/;
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
] as const;

const workflowPins = readWorkspaceManifests().flatMap(({ file, manifest }) =>
  DEPENDENCY_FIELDS.flatMap((field) =>
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
