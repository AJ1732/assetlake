import type { DeleteImageInput } from "../contracts";
import { AssetLakeError } from "../errors/asset-lake-error";
import type { Logger } from "../logging/logger";
import type { AssetLakeStore } from "../store/asset-lake-store";
import { deleteAssetIfUnreferenced } from "./compensate";
import { requireImage } from "./require-image";

/**
 * Removes the record, then the asset only if nothing else references it. Not a revocation: CDN
 * caches may keep serving a deleted asset for a while. Once the record is gone the delete has
 * happened, so an asset that can't be removed is logged, not thrown.
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
    const image = requireImage(await store.findImage(id), id);

    const ownsImage =
      image.entity?.type === actorEntity.type &&
      image.entity.id === actorEntity.id;
    if (!ownsImage)
      throw new AssetLakeError(
        "FORBIDDEN",
        "You can only delete your own images.",
      );

    await store.deleteImage(id);
    const { assetId } = image.asset;
    const { outcome, reason } = await deleteAssetIfUnreferenced(store, assetId);
    logger.log(
      outcome === "failed" ? "warn" : "info",
      "ASSET_DELETE_COMPLETED",
      {
        imageId: id,
        assetId,
        assetDeleted: outcome === "deleted",
        ...(reason ? { reason } : {}),
      },
    );
  };
}
