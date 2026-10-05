// Eval lane target, mirroring packages/assetlake-core/tests/live/live-target.ts: the demo project's
// synthetic `test` dataset by default, never production.
export const liveTarget = {
  projectId: process.env.SANITY_PROJECT_ID ?? "oshzwvjy",
  dataset: process.env.SANITY_TEST_DATASET ?? "test",
  apiVersion: "2026-10-04",
  token: process.env.SANITY_WRITE_TOKEN ?? "",
};
