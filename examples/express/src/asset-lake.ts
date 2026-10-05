import { createAssetLake } from "@assetlake/core";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} (see .env.example).`);
  return value;
}

const remoteHosts = (process.env.ASSETLAKE_REMOTE_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

export const applicationId = required("ASSETLAKE_APPLICATION_ID");

// One instance per process: it caches presets and holds the write token, so keep it server-side.
export const assetLake = createAssetLake({
  projectId: required("SANITY_PROJECT_ID"),
  dataset: required("SANITY_DATASET"),
  apiVersion: "2026-10-04",
  token: required("SANITY_WRITE_TOKEN"),
  remoteUploads: { allowedHosts: remoteHosts },
});
