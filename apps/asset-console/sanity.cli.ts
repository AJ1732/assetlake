import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  app: {
    organizationId: "o5eRlVKEZ",
    entry: "./src/app.tsx",
    title: "AssetLake Console",
  },
  // Written from the first `sanity deploy --create --json` (2026-10-04). Never invent this id.
  deployment: {
    appId: "otc94a70i1qncgk3i3hmzosp",
  },
});
