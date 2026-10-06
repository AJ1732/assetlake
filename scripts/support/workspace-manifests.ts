import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { ROOT } from "./pack-workspace";

export const WORKSPACE_GROUPS = ["apps", "packages"] as const;

export interface WorkspaceManifest {
  name?: string;
  version?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface WorkspaceManifestFile {
  /** Relative to the repo root, e.g. `packages/assetlake-core/package.json`. */
  file: string;
  manifest: WorkspaceManifest;
}

function packageManifestFiles(group: string): string[] {
  return readdirSync(path.join(ROOT, group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(group, entry.name, "package.json"));
}

/** The root manifest, then every workspace package's. */
export function readWorkspaceManifests(): WorkspaceManifestFile[] {
  const files = [
    "package.json",
    ...WORKSPACE_GROUPS.flatMap(packageManifestFiles),
  ];
  return files.map((file) => ({
    file,
    manifest: JSON.parse(
      readFileSync(path.join(ROOT, file), "utf8"),
    ) as WorkspaceManifest,
  }));
}
