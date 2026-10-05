import type { EntityRef } from "@assetlake/core";

import { UsageError } from "../cli-errors";

// Core only deletes an image for its owning entity. Uploads without --entity-* belong to the CLI,
// so `assetlake delete` can remove them later with no flags.
export const CLI_OWNER: EntityRef = { type: "cli", id: "assetlake-cli" };

export function toEntity(flags: {
  entityType?: string;
  entityId?: string;
}): EntityRef {
  const { entityType, entityId } = flags;
  if (!entityType && !entityId) return CLI_OWNER;
  if (!entityType || !entityId) {
    throw new UsageError("Pass --entity-type and --entity-id together.");
  }
  return { type: entityType, id: entityId };
}
