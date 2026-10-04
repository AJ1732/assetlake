import { describe, expect, it } from "vitest";

import { orderPresets } from "./preset-order";

describe("orderPresets", () => {
  it("puts the demo presets first, small to large, then the rest alphabetically", () => {
    const slugs = ["hero", "zoom", "card", "avatar", "banner", "avatar-sm"].map(
      (slug) => ({ slug }),
    );
    expect(orderPresets(slugs).map((preset) => preset.slug)).toEqual([
      "avatar-sm",
      "avatar",
      "card",
      "hero",
      "banner",
      "zoom",
    ]);
  });
});
