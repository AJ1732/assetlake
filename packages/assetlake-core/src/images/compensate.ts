import type { LogEvent, Logger } from "../logging/logger";
import type { AssetLakeStore } from "../store/asset-lake-store";

export type AssetDeleteOutcome = "deleted" | "referenced" | "failed";

/**
 * Sanity dedupes identical bytes into one asset id, so the asset may belong to another record: a
 * "referenced" refusal means keep it. Never throws; a failure comes back with its reason.
 */
export async function deleteAssetIfUnreferenced(
  store: AssetLakeStore,
  assetId: string,
): Promise<{ outcome: AssetDeleteOutcome; reason?: string }> {
  try {
    return { outcome: await store.deleteAsset(assetId) };
  } catch (error) {
    return {
      outcome: "failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

const COMPENSATION_EVENT: Record<AssetDeleteOutcome, LogEvent> = {
  deleted: "ASSET_COMPENSATION_DELETED",
  referenced: "ASSET_COMPENSATION_SKIPPED_REFERENCED",
  failed: "ASSET_COMPENSATION_DELETE_FAILED",
};

/**
 * Best-effort removal of an asset uploaded by a failed request. Never throws, so the caller's
 * original error is the one that surfaces.
 */
export async function compensateAsset(
  store: AssetLakeStore,
  logger: Logger,
  assetId: string,
): Promise<void> {
  const { outcome, reason } = await deleteAssetIfUnreferenced(store, assetId);
  logger.log(
    outcome === "failed" ? "error" : "info",
    COMPENSATION_EVENT[outcome],
    reason ? { assetId, reason } : { assetId },
  );
}
