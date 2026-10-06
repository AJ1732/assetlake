import type {
  ImageStatusTransition,
  TransitionStatusInput,
} from "../contracts";
import { AssetLakeError } from "../errors/asset-lake-error";
import type { Logger } from "../logging/logger";
import type { AssetLakeStore } from "../store/asset-lake-store";

/**
 * The server-side half of review: the only path from "review" to "ready" or "rejected". Workflow
 * engine checks are advisory, so this re-checks the reviewer and the current status itself.
 */
export function createTransitionStatus({
  store,
  logger,
  reviewerIds,
}: {
  store: AssetLakeStore;
  logger: Logger;
  reviewerIds: readonly string[];
}) {
  function refuse(
    imageId: string,
    code: "FORBIDDEN" | "IMAGE_NOT_FOUND" | "INVALID_STATUS_TRANSITION",
    message: string,
  ): never {
    logger.log("warn", "IMAGE_STATUS_TRANSITION_REFUSED", { imageId, code });
    throw new AssetLakeError(code, message);
  }

  return async function transitionStatus({
    id,
    to,
    reviewer,
  }: TransitionStatusInput): Promise<ImageStatusTransition> {
    if (!reviewerIds.includes(reviewer.id))
      refuse(id, "FORBIDDEN", "This reviewer may not review images.");

    const image = await store.findImage(id);
    if (!image) refuse(id, "IMAGE_NOT_FOUND", `Image ${id} does not exist.`);

    const from = image.status;
    // A drainer can deliver the same decision twice; the second delivery must succeed quietly.
    if (from === to) {
      logger.log("info", "IMAGE_STATUS_TRANSITIONED", {
        imageId: id,
        from,
        to,
        outcome: "unchanged",
      });
      return { id, from, to, outcome: "unchanged" };
    }
    if (from !== "review")
      refuse(
        id,
        "INVALID_STATUS_TRANSITION",
        `Only an image in review can become ${to}; this one is ${from}.`,
      );

    const write = await store.updateImageStatus(id, {
      status: to,
      ifRevision: image.revision,
    });
    if (write === "conflict")
      refuse(
        id,
        "INVALID_STATUS_TRANSITION",
        "The image changed while it was being reviewed. Review it again.",
      );

    logger.log("info", "IMAGE_STATUS_TRANSITIONED", {
      imageId: id,
      from,
      to,
      outcome: "applied",
    });
    return { id, from, to, outcome: "applied" };
  };
}
