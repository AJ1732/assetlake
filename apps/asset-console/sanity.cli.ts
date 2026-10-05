import { defineCliConfig } from "sanity/cli";

import { resolveConsoleDeployment } from "./src/data/config";

// The Sanity CLI loads this app's .env files into process.env before reading this file.
const { organizationId, appId } = resolveConsoleDeployment(process.env);

export default defineCliConfig({
  app: {
    organizationId,
    entry: "./src/app.tsx",
    title: "AssetLake Console",
  },
  ...(appId ? { deployment: { appId } } : {}),
});
