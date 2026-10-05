// Eval lane target. Defaults to the demo project's synthetic `test` dataset, never production.
// SANITY_PROJECT_ID points the lane at another project (bring your own).
export const liveTarget = {
  projectId: process.env.SANITY_PROJECT_ID?.trim() || "oshzwvjy", // blank in .env.local = unset
  dataset: process.env.SANITY_TEST_DATASET ?? "test",
  apiVersion: process.env.SANITY_API_VERSION ?? "2026-10-04",
  token: process.env.SANITY_WRITE_TOKEN ?? "",
};
