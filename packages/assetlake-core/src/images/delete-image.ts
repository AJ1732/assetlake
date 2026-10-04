import type { DeleteImageInput } from "../contracts";
import { AssetLakeError } from "../errors/asset-lake-error";
import type { Logger } from "../logging/logger";
import type { AssetLakeStore } from "../store/asset-lake-store";

/**
 * Removes the record, then the asset only if nothing else references it. Not a revocation: CDN
 * caches may keep serving a deleted asset for a while (handoff §12).
 */
export function createDeleteImage({
  store,
  logger,
}: {
  store: AssetLakeStore;
  logger: Logger;
}) {
  return async function deleteImage({
    id,
    actorEntity,
  }: DeleteImageInput): Promise<void> {
    const image = await store.findImage(id);
    if (!image)
      throw new AssetLakeError(
        "IMAGE_NOT_FOUND",
        `Image ${id} does not exist.`,
      );

    const ownsImage =
      image.entity?.type === actorEntity.type &&
      image.entity.id === actorEntity.id;
    if (!ownsImage)
      throw new AssetLakeError(
        "FORBIDDEN",
        "You can only delete your own images.",
      );

    await store.deleteImage(id);
    const assetOutcome = await store.deleteAsset(image.asset.assetId);
    logger.log("info", "ASSET_DELETE_COMPLETED", {
      imageId: id,
      assetId: image.asset.assetId,
      assetDeleted: assetOutcome === "deleted",
    });
  };
}
