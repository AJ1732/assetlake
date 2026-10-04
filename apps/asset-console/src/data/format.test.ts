import { describe, expect, it } from "vitest";

import {
  formatBytes,
  formatDimensions,
  formatExactBytes,
  formatLabel,
  formatTimestamp,
  MISSING,
} from "./format";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1536, "1.5 KB"],
    [5 * 1024 * 1024, "5 MB"],
    [3.25 * 1024 * 1024 * 1024, "3.3 GB"],
  ])("formats %d as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it.each([null, undefined, Number.NaN, -1])(
    "reports %s as missing",
    (bytes) => {
      expect(formatBytes(bytes)).toBe(MISSING);
    },
  );
});

describe("formatExactBytes", () => {
  it("groups digits and names the unit", () => {
    expect(formatExactBytes(1_234_567)).toBe("1,234,567 bytes");
  });

  it("reports a missing size", () => {
    expect(formatExactBytes(null)).toBe(MISSING);
  });
});

describe("formatDimensions", () => {
  it("joins width and height", () => {
    expect(formatDimensions(1600, 900)).toBe("1600 × 900");
  });

  it.each([
    [null, 900],
    [1600, null],
    [undefined, undefined],
  ])("reports %s x %s as missing", (width, height) => {
    expect(formatDimensions(width, height)).toBe(MISSING);
  });
});

describe("formatTimestamp", () => {
  it("formats an ISO timestamp in the given time zone", () => {
    // ICU separates "PM" with U+202F on newer Node versions, so match any space.
    expect(formatTimestamp("2026-10-04T12:30:00.000Z", "UTC")).toMatch(
      /^Oct 4, 2026, 12:30\sPM$/,
    );
  });

  it.each([null, undefined, "", "not a date"])(
    "reports %s as missing",
    (iso) => {
      expect(formatTimestamp(iso)).toBe(MISSING);
    },
  );
});

describe("formatLabel", () => {
  it("capitalizes a schema value", () => {
    expect(formatLabel("avatar")).toBe("Avatar");
  });

  it("reports a missing value", () => {
    expect(formatLabel(null)).toBe(MISSING);
  });
});
