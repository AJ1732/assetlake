import type {
  AssetLakeImageResult,
  UploadImageFromUrlInput,
} from "../contracts";
import { AssetLakeError, hasStatusCode } from "../errors/asset-lake-error";
import { checkSourceUrl } from "../policies/check-source-url";
import { validateAfterRemoteUpload } from "../policies/validate-upload";
import type { StoredAsset } from "../store/asset-lake-store";
import { runUploadPipeline, type UploadDependencies } from "./upload-pipeline";

// The host is the only part of the URL that is safe to log: presigned URLs carry signatures.
function hostOf(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname : "(invalid url)";
}

// Statuses Sanity returned in the B11 spikes: 400 for an unreachable source, 422 for bytes it
// can't decode. A 401/403 is our token, not the source.
function toFetchFailure(error: unknown): AssetLakeError {
  const options = { cause: error };
  if (hasStatusCode(error, 422))
    return new AssetLakeError(
      "UNSUPPORTED_IMAGE_TYPE",
      "The source is not an image Sanity can process.",
      options,
    );
  if (hasStatusCode(error, 413))
    return new AssetLakeError(
      "FILE_TOO_LARGE",
      "The source is larger than Sanity accepts.",
      options,
    );
  if (hasStatusCode(error, 401) || hasStatusCode(error, 403))
    return new AssetLakeError(
      "UPLOAD_FAILED",
      "The image could not be stored.",
      options,
    );
  return new AssetLakeError(
    "SOURCE_FETCH_FAILED",
    "The source URL could not be fetched.",
    options,
  );
}

/**
 * Sanity fetches the URL, so large files never pass through the caller and the token never leaves
 * it. The trade-off: policy checks run after the upload, and a rejected file is public on the CDN
 * until the compensating delete lands.
 */
export function createUploadImageFromUrl(
  dependencies: UploadDependencies,
  allowedHosts: readonly string[],
) {
  const { store, logger } = dependencies;

  return function uploadImageFromUrl(
    input: UploadImageFromUrlInput,
  ): Promise<AssetLakeImageResult> {
    const sourceHost = hostOf(input.url);

    async function fetchAsset(): Promise<StoredAsset> {
      try {
        return await store.uploadImageAssetFromUrl(input.url, {
          filename: input.filename,
        });
      } catch (error) {
        // Sanity: on a timeout "the asset may already have been created".
        if (hasStatusCode(error, 504))
          logger.log("warn", "ASSET_UPLOAD_FAILED", {
            applicationId: input.applicationId,
            sourceHost,
            mayExist: true,
          });
        throw toFetchFailure(error);
      }
    }

    return runUploadPipeline(dependencies, input, {
      logFields: { source: "url", sourceHost },
      validateBeforeUpload: () => {
        checkSourceUrl(input.url, allowedHosts);
      },
      storeAsset: fetchAsset,
      validateAfterUpload: validateAfterRemoteUpload,
    });
  };
}
