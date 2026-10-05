import "server-only";

import { type AssetLake, createAssetLake } from "@assetlake/core";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} (see .env.example).`);
  return value;
}

let instance: AssetLake | undefined;

// Created on first request, not at import: `next build` imports route modules, and the build
// shouldn't need the write token. One instance per server process (it caches presets).
export function getAssetLake(): AssetLake {
  instance ??= createAssetLake({
    projectId: required("SANITY_PROJECT_ID"),
    dataset: required("SANITY_DATASET"),
    apiVersion: "2026-10-04",
    token: required("SANITY_WRITE_TOKEN"),
    remoteUploads: {
      allowedHosts: (process.env.ASSETLAKE_REMOTE_HOSTS ?? "")
        .split(",")
        .map((host) => host.trim())
        .filter(Boolean),
    },
  });
  return instance;
}

export const getApplicationId = () => required("ASSETLAKE_APPLICATION_ID");
