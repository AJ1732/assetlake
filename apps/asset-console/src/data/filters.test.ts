import { describe, expect, it } from "vitest";

import {
  applicationOptions,
  filterImages,
  hasActiveFilters,
  NO_FILTERS,
} from "./filters";
import { imageRow } from "./test-fixtures";

const campus = { id: "app-campus", name: "Campus Demo" };
const blog = { id: "app-blog", name: "Blog" };

const rows = [
  imageRow({
    id: "1",
    application: campus,
    purpose: "avatar",
    status: "ready",
  }),
  imageRow({
    id: "2",
    application: campus,
    purpose: "cover",
    status: "review",
  }),
  imageRow({ id: "3", application: blog, purpose: "avatar", status: "ready" }),
  imageRow({ id: "4", application: null, purpose: "avatar", status: "failed" }),
];

const ids = (result: { id: string }[]) => result.map((row) => row.id);

describe("filterImages", () => {
  it("returns every row with no filters", () => {
    expect(ids(filterImages(rows, NO_FILTERS))).toEqual(["1", "2", "3", "4"]);
  });

  it("filters by application", () => {
    expect(
      ids(filterImages(rows, { ...NO_FILTERS, applicationId: campus.id })),
    ).toEqual(["1", "2"]);
  });

  it("filters by purpose", () => {
    expect(
      ids(filterImages(rows, { ...NO_FILTERS, purpose: "cover" })),
    ).toEqual(["2"]);
  });

  it("filters by status", () => {
    expect(ids(filterImages(rows, { ...NO_FILTERS, status: "ready" }))).toEqual(
      ["1", "3"],
    );
  });

  it("combines filters", () => {
    expect(
      ids(
        filterImages(rows, {
          applicationId: campus.id,
          purpose: "avatar",
          status: "ready",
        }),
      ),
    ).toEqual(["1"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(
      filterImages(rows, {
        applicationId: blog.id,
        purpose: "cover",
        status: null,
      }),
    ).toEqual([]);
  });
});

describe("hasActiveFilters", () => {
  it("is false with no filters and true with any filter", () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, status: "ready" })).toBe(true);
  });
});

describe("applicationOptions", () => {
  it("dedupes applications, skips missing ones, and sorts by name", () => {
    expect(applicationOptions(rows)).toEqual([blog, campus]);
  });

  it("falls back to the id when an application has no name", () => {
    expect(
      applicationOptions([
        imageRow({ application: { id: "app-x", name: null } }),
      ]),
    ).toEqual([{ id: "app-x", name: "app-x" }]);
  });
});
