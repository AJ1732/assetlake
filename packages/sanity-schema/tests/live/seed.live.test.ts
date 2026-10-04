import { createClient } from "@sanity/client";
import { describe, expect, it } from "vitest";

import { SANITY_PROJECT_ID } from "../../src/project";
import { applySeed } from "../../src/seed/applySeed";
import { readSeedConfig } from "../../src/seed/seedConfig";
import { seedDocuments } from "../../src/seed/seedDocuments";

// Eval lane: runs against SANITY_TEST_DATASET (default "test"), never production.
const seedConfig = readSeedConfig(
  { ...process.env, SANITY_DATASET: process.env.SANITY_TEST_DATASET ?? "test" },
  [],
);
const documents = seedDocuments();
const ids = documents.map((document) => document._id);
const clientConfig = {
  projectId: SANITY_PROJECT_ID,
  dataset: seedConfig.dataset,
  apiVersion: seedConfig.apiVersion,
  useCdn: false,
};

describe(`seed against "${seedConfig.dataset}"`, () => {
  it("is idempotent: two runs leave exactly the six seeded documents", async () => {
    const client = createClient({ ...clientConfig, token: seedConfig.token });
    await applySeed(client, documents, "create-if-missing");
    await applySeed(client, documents, "create-if-missing");

    const count = await client.fetch<number>("count(*[_id in $ids])", { ids });
    expect(count).toBe(6);
  });

  it("is readable without a token (public dataset, root-path ids)", async () => {
    const publicClient = createClient(clientConfig);
    const found = await publicClient.fetch<string[]>("*[_id in $ids]._id", {
      ids,
    });
    expect(found.sort()).toEqual([...ids].sort());
  });
});
