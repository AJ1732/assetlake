// Executed directly by Node 24 type stripping (no build step), so relative imports carry ".ts".
import { createClient } from "@sanity/client";

import { SANITY_PROJECT_ID } from "../project.ts";
import { applySeed } from "./apply-seed.ts";
import { readSeedConfig } from "./seed-config.ts";
import { seedDocuments } from "./seed-documents.ts";

const seedConfig = readSeedConfig(process.env, process.argv.slice(2));

const client = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: seedConfig.dataset,
  apiVersion: seedConfig.apiVersion,
  token: seedConfig.token,
  useCdn: false,
});

const count = await applySeed(client, seedDocuments(), seedConfig.mode);

console.log(
  JSON.stringify({
    event: "SEED_COMPLETED",
    dataset: seedConfig.dataset,
    mode: seedConfig.mode,
    documents: count,
  }),
);
