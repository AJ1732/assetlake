import { describe, expect, it } from "vitest";

import { schemaTypes } from "./index";

describe("@assetlake/sanity-schema entry point", () => {
  it("exports a schema type list for sanity.config.ts to consume", () => {
    expect(Array.isArray(schemaTypes)).toBe(true);
  });
});
