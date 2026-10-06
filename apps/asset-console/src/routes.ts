// The App SDK ships no router, and the app runs inside the Dashboard frame: a typed union in state
// is all the navigation five screens need.

export type TabScreen = "overview" | "assets" | "review" | "presets";

export interface AssetRoute {
  screen: "asset";
  imageId: string;
  from: TabScreen;
}

export type Route = { screen: TabScreen } | AssetRoute;

export const TABS: ReadonlyArray<{ screen: TabScreen; label: string }> = [
  { screen: "overview", label: "Overview" },
  { screen: "assets", label: "Assets" },
  { screen: "review", label: "Review" },
  { screen: "presets", label: "Presets" },
];

export const INITIAL_ROUTE: Route = { screen: "overview" };

export const activeTab = (route: Route): TabScreen =>
  route.screen === "asset" ? route.from : route.screen;

export const assetRoute = (imageId: string, current: Route): AssetRoute => ({
  screen: "asset",
  imageId,
  from: activeTab(current),
});
