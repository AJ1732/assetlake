import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Static imports and re-exports only: a dynamic import() is a deliberate lazy edge, not part of
// what loading the module costs.
const IMPORT = /^\s*(?:import|export)\s[^"']*?from\s+["']([^"']+)["']/gm;

/** Every file and package a module loads, following relative imports through the source tree. */
export function importGraph(
  entry: string,
  seen = new Set<string>(),
): Set<string> {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  for (const [, specifier] of readFileSync(entry, "utf8").matchAll(IMPORT)) {
    if (specifier.startsWith(".")) {
      importGraph(resolve(dirname(entry), `${specifier}.ts`), seen);
    } else {
      seen.add(specifier);
    }
  }
  return seen;
}
