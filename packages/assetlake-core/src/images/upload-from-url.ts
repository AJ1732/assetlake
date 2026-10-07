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

// Sanity's from-url endpoint answers 400 for an unreachable source and 422 for bytes it can't
// decode. A 401/403 is our token, not the source.
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
  const { store } = dependencies;

  return function uploadImageFromUrl(
    input: UploadImageFromUrlInput,
  ): Promise<AssetLakeImageResult> {
    async function fetchAsset(): Promise<StoredAsset> {
      try {
        return await store.uploadImageAssetFromUrl(input.url, {
          filename: input.filename,
        });
      } catch (error) {
        throw toFetchFailure(error);
      }
    }

    return runUploadPipeline(dependencies, input, {
      // Logged at the start, before the URL is checked, so a refused URL's host is on record too.
      logFields: { source: "url", sourceHost: hostOf(input.url) },
      validateBeforeUpload: () => {
        checkSourceUrl(input.url, allowedHosts);
      },
      storeAsset: fetchAsset,
      validateAfterUpload: validateAfterRemoteUpload,
      // Sanity: on a timeout "the asset may already have been created", so callers check first.
      failureLogFields: (error) =>
        hasStatusCode(error.cause, 504) ? { mayExist: true } : {},
    });
  };
}
