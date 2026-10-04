import type { Logger } from "../logging/logger";
import type { AssetLakeStore } from "../store/asset-lake-store";

/**
 * Best-effort removal of an asset uploaded by a failed request. Sanity dedupes identical bytes into
 * one asset id, so the asset may belong to another record: a "referenced" refusal means keep it.
 * Never throws, so the caller's original error is the one that surfaces (handoff §11.5).
 */
export async function compensateAsset(
  store: AssetLakeStore,
  logger: Logger,
  assetId: string,
): Promise<void> {
  try {
    const outcome = await store.deleteAsset(assetId);
    logger.log(
      "info",
      outcome === "deleted"
        ? "ASSET_COMPENSATION_DELETED"
        : "ASSET_COMPENSATION_SKIPPED_REFERENCED",
      { assetId },
    );
  } catch (error) {
    logger.log("error", "ASSET_COMPENSATION_DELETE_FAILED", {
      assetId,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
