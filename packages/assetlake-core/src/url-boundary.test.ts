import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { importGraph } from "./testing/import-graph";

// "@assetlake/core/url" ships to browsers. Walk its relative import graph and prove it never
// reaches the write client, Node built-ins, or the upload path.
const FORBIDDEN =
  /^(@sanity\/client|node:|file-type|zod)|\/(store|images|client|testing)\//;

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
