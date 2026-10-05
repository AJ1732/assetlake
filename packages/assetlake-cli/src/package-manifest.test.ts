import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

type PackageManifest = { dependencies: Record<string, string> };

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageManifest;
const sourceDirectory = fileURLToPath(new URL(".", import.meta.url));
const IMPORT = /^\s*(?:import|export)\s[^"']*?from\s+["']([^"']+)["']/gm;

const isShippedSource = (file: string) =>
  file.endsWith(".ts") &&
  !file.endsWith(".test.ts") &&
  file !== "test-support.ts";

function packageName(specifier: string): string {
  const [scope, name] = specifier.split("/");
  return specifier.startsWith("@") ? `${scope}/${name}` : scope;
}

function bareImports(): Set<string> {
  const files = readdirSync(sourceDirectory, { recursive: true })
    .map(String)
    .filter(isShippedSource);
  const specifiers = files.flatMap((file) => {
    const source = readFileSync(join(sourceDirectory, file), "utf8");
    return [...source.matchAll(IMPORT)].map(([, specifier]) => specifier);
  });
  return new Set(
    specifiers
      .filter((specifier) => !specifier.startsWith("."))
      .filter((specifier) => !specifier.startsWith("node:"))
      .filter((specifier) => !builtinModules.includes(specifier))
      .map(packageName),
  );
}

// tsdown inlines anything that is not a declared dependency, so an undeclared import would ship a
// private copy inside dist/main.js instead of failing loudly.
describe("@assetlake/cli publish manifest", () => {
  it("declares every package the shipped source imports", () => {
    const undeclared = [...bareImports()].filter(
      (name) => !(name in manifest.dependencies),
    );
    expect(undeclared).toEqual([]);
  });

  it("takes core as a caret range so pnpm publishes ^<version>, not an exact pin", () => {
    expect(manifest.dependencies["@assetlake/core"]).toBe("workspace:^");
  });
});
