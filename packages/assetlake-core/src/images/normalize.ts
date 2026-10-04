import type { AssetLakeImageResult } from "../contracts";
import type { StoredAsset } from "../store/AssetLakeStore";

export function normalizeImage(
  id: string,
  status: AssetLakeImageResult["status"],
  asset: StoredAsset,
): AssetLakeImageResult {
  const { width, height } = asset;
  return {
    id,
    assetId: asset.assetId,
    url: asset.url,
    mimeType: asset.mimeType,
    size: asset.size,
    width,
    height,
    aspectRatio: width && height ? width / height : null,
    lqip: asset.lqip,
    blurHash: asset.blurHash,
    status,
  };
}

// The contract only distinguishes usable ("ready") from not-yet-usable ("review"). Anything other
// than ready (processing, rejected, failed) must never be reported as usable.
export function toResultStatus(status: string): AssetLakeImageResult["status"] {
  return status === "ready" ? "ready" : "review";
}
