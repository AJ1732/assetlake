import { createHash, randomUUID } from "node:crypto";

// No "." anywhere: dotted ids are private paths that tokenless reads cannot see.
const IMAGE_ID_PREFIX = "assetlake-image-";

export interface ImageIdentity {
  id: string;
  idempotencyKeyHash?: string;
}

export interface IdGenerator {
  randomId(): string;
}

export const cryptoIdGenerator: IdGenerator = { randomId: () => randomUUID() };

/** Same actor + key always yields the same id, so a retried upload finds the first result. */
export function resolveImageIdentity(
  actorId: string,
  idempotencyKey: string | undefined,
  ids: IdGenerator,
): ImageIdentity {
  if (!idempotencyKey) return { id: `${IMAGE_ID_PREFIX}${ids.randomId()}` };
  const idempotencyKeyHash = createHash("sha256")
    .update(`${actorId}:${idempotencyKey}`)
    .digest("hex");
  return { id: `${IMAGE_ID_PREFIX}${idempotencyKeyHash}`, idempotencyKeyHash };
}
