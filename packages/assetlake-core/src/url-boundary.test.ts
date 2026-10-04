import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// "@assetlake/core/url" ships to browsers. Walk its relative import graph and prove it never
// reaches the write client, Node built-ins, or the upload path.
const FORBIDDEN =
  /^(@sanity\/client|node:|file-type|zod)|\/(store|images|client|testing)\//;
const IMPORT = /^\s*(?:import|export)\s[^"']*?from\s+["']([^"']+)["']/gm;

function importGraph(entry: string, seen = new Set<string>()): Set<string> {
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

describe("@assetlake/core/url boundary", () => {
  it("imports nothing server-only", () => {
    const entry = fileURLToPath(new URL("url.ts", import.meta.url));
    const graph = [...importGraph(entry)].map((path) =>
      path.replace(dirname(entry), "."),
    );
    expect(graph.filter((path) => FORBIDDEN.test(path))).toEqual([]);
    expect(graph).toContain("@sanity/image-url");
  });
});
