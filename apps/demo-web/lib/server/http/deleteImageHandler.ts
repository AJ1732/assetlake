import "server-only";

import type { AssetLake } from "@assetlake/core";

import { failure, toFailureResponse } from "../httpErrors";
import type { HandlerResult } from "../requestLog";
import { sessionEntity } from "../sessionToken";
import {
  authenticate,
  type SessionVerifier,
  unauthenticated,
} from "./authenticate";

export interface DeleteDependencies {
  images: Pick<AssetLake["images"], "delete">;
  sessions: SessionVerifier;
}

// Core ids are `assetlake-image-<uuid|sha256>`. Anything else (dots, slashes) is refused up front.
const IMAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export async function deleteImage(
  request: Request,
  id: string,
  { images, sessions }: DeleteDependencies,
): Promise<HandlerResult> {
  const session = await authenticate(request, sessions);
  if (!session) return unauthenticated();
  const actorId = session.userId;

  if (!IMAGE_ID_PATTERN.test(id))
    return {
      response: failure("BAD_REQUEST", "That is not a valid image id."),
      actorId,
    };

  try {
    await images.delete({ id, actorEntity: sessionEntity(session) });
    return { response: new Response(null, { status: 204 }), actorId };
  } catch (error) {
    return { response: toFailureResponse(error), actorId, error };
  }
}
