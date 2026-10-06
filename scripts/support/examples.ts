import { cpSync, readdirSync } from "node:fs";
import path from "node:path";

import { exec, ROOT } from "./pack-workspace";

const EXAMPLES_DIRECTORY = path.join(ROOT, "examples");
const LOCAL_ONLY = new Set(["node_modules", ".next", ".env", ".env.local"]);

export function listExamples(): string[] {
  return readdirSync(EXAMPLES_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * Copies `examples/<name>` into `work` and npm-installs it with the packed core tarball in place
 * of the npm range, exactly as a user would install it.
 */
export function prepareExample(
  name: string,
  work: string,
  coreTarball: string,
): string {
  const directory = path.join(work, name);
  cpSync(path.join(EXAMPLES_DIRECTORY, name), directory, {
    recursive: true,
    filter: (source) => !LOCAL_ONLY.has(path.basename(source)),
  });
  exec(
    "npm",
    ["install", "--no-audit", "--no-fund", "--loglevel=error", coreTarball],
    directory,
  );
  return directory;
}
