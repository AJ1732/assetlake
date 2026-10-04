import type { SanityClient } from "@sanity/client";

import type { SeedMode } from "./seed-config.ts";
import type { SeedDocument } from "./seed-documents.ts";

// "create-if-missing" is the default so rerunning the seed never reverts preset edits made live in
// the console; "reset" restores the seeded values on purpose.
export async function applySeed(
  client: SanityClient,
  documents: readonly SeedDocument[],
  mode: SeedMode,
): Promise<number> {
  const transaction = client.transaction();
  for (const document of documents) {
    if (mode === "reset") {
      transaction.createOrReplace(document);
    } else {
      transaction.createIfNotExists(document);
    }
  }
  await transaction.commit({ visibility: "sync" });
  return documents.length;
}
