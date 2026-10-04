import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ORIGINAL_BYTES_LABEL } from "./aggregate";

// Handoff §31 rule 11: the console must never present asset sizes as account usage.
const FORBIDDEN_WORD = /bandwidth/i;
const SOURCE_ROOT = fileURLToPath(new URL("..", import.meta.url));

function appSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return appSourceFiles(path);
    const isSource = /\.tsx?$/.test(entry.name);
    const isTest = /\.test\.tsx?$/.test(entry.name);
    return isSource && !isTest ? [path] : [];
  });
}

describe("original byte label (handoff §31 rule 11)", () => {
  it("is exactly the approved wording", () => {
    expect(ORIGINAL_BYTES_LABEL).toBe("Original bytes of listed assets");
    expect(ORIGINAL_BYTES_LABEL).not.toMatch(FORBIDDEN_WORD);
  });

  it("is not contradicted by any app source file", () => {
    const files = appSourceFiles(SOURCE_ROOT);
    expect(files.length).toBeGreaterThan(5);
    const offenders = files.filter((path) =>
      FORBIDDEN_WORD.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
