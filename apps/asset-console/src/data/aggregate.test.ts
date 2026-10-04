import { describe, expect, it } from "vitest";

import {
  countBy,
  recentUploads,
  shareOfTotal,
  summarize,
  sumOriginalBytes,
  UNSET_KEY,
} from "./aggregate";
import { imageRow } from "./test-fixtures";

const countOf = (buckets: { key: string; count: number }[], key: string) =>
  buckets.find((bucket) => bucket.key === key)?.count;

describe("countBy", () => {
  it("keeps known keys in order with zero counts", () => {
    const buckets = countBy([{ k: "b" }], (row) => row.k, ["a", "b"]);
    expect(buckets).toEqual([
      { key: "a", count: 0 },
      { key: "b", count: 1 },
    ]);
  });

  it("appends unknown and unset keys after the known ones", () => {
    const buckets = countBy(
      [{ k: "zzz" }, { k: null }, { k: undefined }],
      (row) => row.k,
      ["a"],
    );
    expect(buckets).toEqual([
      { key: "a", count: 0 },
      { key: "zzz", count: 1 },
      { key: UNSET_KEY, count: 2 },
    ]);
  });
});

describe("summarize", () => {
  const items = [
    imageRow({ id: "1", status: "ready", purpose: "avatar" }),
    imageRow({ id: "2", status: "ready", purpose: "cover" }),
    imageRow({ id: "3", status: "review", purpose: "avatar" }),
    imageRow({ id: "4", status: null, purpose: null }),
  ];

  it("counts by status", () => {
    const { byStatus } = summarize({ total: 4, items });
    expect(countOf(byStatus, "ready")).toBe(2);
    expect(countOf(byStatus, "review")).toBe(1);
    expect(countOf(byStatus, "failed")).toBe(0);
    expect(countOf(byStatus, UNSET_KEY)).toBe(1);
  });

  it("counts by purpose", () => {
    const { byPurpose } = summarize({ total: 4, items });
    expect(countOf(byPurpose, "avatar")).toBe(2);
    expect(countOf(byPurpose, "cover")).toBe(1);
    expect(countOf(byPurpose, "content")).toBe(0);
  });

  it("reports the true total separately from the listed rows", () => {
    const summary = summarize({ total: 900, items });
    expect(summary.total).toBe(900);
    expect(summary.listed).toBe(4);
  });

  it("summarizes an empty dataset", () => {
    const summary = summarize({ total: 0, items: [] });
    expect(summary.originalBytes).toBe(0);
    expect(summary.recent).toEqual([]);
    expect(summary.byStatus.every((bucket) => bucket.count === 0)).toBe(true);
  });
});

describe("sumOriginalBytes", () => {
  it("adds asset sizes", () => {
    const rows = [
      imageRow({ asset: { ...imageRow().asset!, size: 1000 } }),
      imageRow({ asset: { ...imageRow().asset!, size: 500 } }),
    ];
    expect(sumOriginalBytes(rows)).toBe(1500);
  });

  it("ignores records with a missing asset or size", () => {
    const rows = [
      imageRow({ asset: { ...imageRow().asset!, size: 1000 } }),
      imageRow({ asset: null }),
      imageRow({ asset: { ...imageRow().asset!, size: null } }),
    ];
    expect(sumOriginalBytes(rows)).toBe(1000);
  });
});

describe("recentUploads", () => {
  it("returns the newest uploads first, capped at the limit", () => {
    const rows = [
      imageRow({ id: "old", uploadedAt: "2026-10-01T00:00:00.000Z" }),
      imageRow({ id: "new", uploadedAt: "2026-10-04T00:00:00.000Z" }),
      imageRow({ id: "mid", uploadedAt: "2026-10-02T00:00:00.000Z" }),
    ];
    expect(recentUploads(rows, 2).map((row) => row.id)).toEqual(["new", "mid"]);
  });

  it("puts records without a valid timestamp last", () => {
    const rows = [
      imageRow({ id: "none", uploadedAt: null }),
      imageRow({ id: "bad", uploadedAt: "nope" }),
      imageRow({ id: "dated", uploadedAt: "2026-10-01T00:00:00.000Z" }),
    ];
    expect(recentUploads(rows, 3)[0]?.id).toBe("dated");
  });

  it("does not mutate its input", () => {
    const rows = [
      imageRow({ id: "a", uploadedAt: "2026-10-01T00:00:00.000Z" }),
      imageRow({ id: "b", uploadedAt: "2026-10-02T00:00:00.000Z" }),
    ];
    recentUploads(rows, 2);
    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
  });
});

describe("shareOfTotal", () => {
  it("returns a percentage to one decimal place", () => {
    expect(shareOfTotal(1, 3)).toBe(33.3);
  });

  it("returns 0 for an empty total", () => {
    expect(shareOfTotal(0, 0)).toBe(0);
  });
});
