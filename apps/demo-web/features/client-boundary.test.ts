import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Backs up the ESLint rule: the server entry of @assetlake/core and lib/server hold the write
// token, so nothing that can end up in a browser bundle may import them.
const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const CLIENT_REACHABLE_DIRECTORIES = ["components", "features", "lib/public"];
const SCANNED_DIRECTORIES = ["app", ...CLIENT_REACHABLE_DIRECTORIES];

const isSource = (file: string) =>
  /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file);
const isServerOnlyModule = (file: string) => /\.server\.(ts|tsx)$/.test(file);

function listSources(directory: string): string[] {
  return readdirSync(path.join(appRoot, directory), {
    withFileTypes: true,
    recursive: true,
  })
    .filter((entry) => entry.isFile() && isSource(entry.name))
    .map((entry) =>
      path.relative(appRoot, path.join(entry.parentPath, entry.name)),
    );
}

function importSpecifiers(source: string): string[] {
  const pattern =
    /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  return [...source.matchAll(pattern)].map((match) => match[1] ?? match[2]);
}

function isForbiddenInClientCode(specifier: string): boolean {
  return (
    specifier === "@assetlake/core" || /(^|\/)lib\/server(\/|$)/.test(specifier)
  );
}

const hasUseClientDirective = (source: string) =>
  /^\s*["']use client["']/.test(source);

const allSources = SCANNED_DIRECTORIES.flatMap(listSources);
const clientReachable = allSources.filter((file) => {
  const inClientDirectory = CLIENT_REACHABLE_DIRECTORIES.some((directory) =>
    file.startsWith(`${directory}/`),
  );
  const source = readFileSync(path.join(appRoot, file), "utf8");
  return (
    hasUseClientDirective(source) ||
    (inClientDirectory && !isServerOnlyModule(file))
  );
});

describe("client import boundary", () => {
  it("scans the client-reachable files", () => {
    expect(clientReachable.length).toBeGreaterThan(0);
  });

  it.each(clientReachable)(
    "%s imports nothing that holds the write token",
    (file) => {
      const source = readFileSync(path.join(appRoot, file), "utf8");
      expect(importSpecifiers(source).filter(isForbiddenInClientCode)).toEqual(
        [],
      );
    },
  );

  it.each(allSources.filter(isServerOnlyModule))(
    "%s is marked server-only",
    (file) => {
      const source = readFileSync(path.join(appRoot, file), "utf8");
      expect(source).toMatch(/^import ["']server-only["'];/m);
    },
  );

  it("recognises the forbidden specifiers", () => {
    expect(isForbiddenInClientCode("@assetlake/core")).toBe(true);
    expect(isForbiddenInClientCode("@/lib/server/asset-lake")).toBe(true);
    expect(isForbiddenInClientCode("../../lib/server/session")).toBe(true);
    expect(isForbiddenInClientCode("@assetlake/core/url")).toBe(false);
    expect(isForbiddenInClientCode("@assetlake/core/contracts")).toBe(false);
  });
});
