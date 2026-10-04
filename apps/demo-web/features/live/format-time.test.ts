import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./format-time";

const NOW = Date.parse("2026-10-04T12:00:00.000Z");

describe("formatRelativeTime", () => {
  it.each([
    ["2026-10-04T11:59:58.000Z", "just now"],
    ["2026-10-04T11:59:30.000Z", "30 seconds ago"],
    ["2026-10-04T11:55:00.000Z", "5 minutes ago"],
    ["2026-10-04T09:00:00.000Z", "3 hours ago"],
    ["2026-10-03T12:00:00.000Z", "yesterday"],
    ["not a date", "unknown time"],
  ])("%s -> %s", (iso, expected) => {
    expect(formatRelativeTime(iso, NOW)).toBe(expected);
  });
});
