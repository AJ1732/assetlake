import { describe, expect, it } from "vitest";

import { activeTab, assetRoute, INITIAL_ROUTE, TABS } from "./routes";

describe("routes", () => {
  it("starts on the overview", () => {
    expect(activeTab(INITIAL_ROUTE)).toBe("overview");
  });

  it("lists the Review Queue as the fifth screen, between assets and presets", () => {
    expect(TABS.map((tab) => tab.screen)).toEqual([
      "overview",
      "assets",
      "review",
      "presets",
    ]);
  });

  it("keeps the originating tab highlighted on the asset detail", () => {
    const detail = assetRoute("assetlake-image-1", { screen: "assets" });
    expect(detail).toEqual({
      screen: "asset",
      imageId: "assetlake-image-1",
      from: "assets",
    });
    expect(activeTab(detail)).toBe("assets");
  });

  it("returns to the original tab when opening a second asset from a detail", () => {
    const first = assetRoute("a", { screen: "overview" });
    expect(assetRoute("b", first).from).toBe("overview");
  });
});
