import type { AssetLakeImageResult, UploadImageInput } from "../contracts";
import { AssetLakeError } from "../errors/asset-lake-error";
import {
  validateBeforeUpload,
  validateDimensions,
} from "../policies/validate-upload";
import type { AssetLakeStore, StoredAsset } from "../store/asset-lake-store";
import { runUploadPipeline, type UploadDependencies } from "./upload-pipeline";

async function uploadAsset(
  store: AssetLakeStore,
  input: UploadImageInput,
): Promise<StoredAsset> {
  try {
    return await store.uploadImageAsset(input.body, {
      filename: input.filename,
      contentType: input.contentType,
    });
  } catch (error) {
    throw new AssetLakeError(
      "UPLOAD_FAILED",
      "The image could not be stored.",
      { cause: error },
    );
  }
}

/** Bytes in hand: every policy check except dimensions runs before anything reaches Sanity. */
export function createUploadImage(dependencies: UploadDependencies) {
  return function uploadImage(
    input: UploadImageInput,
  ): Promise<AssetLakeImageResult> {
    return runUploadPipeline(dependencies, input, {
      logFields: { source: "bytes", bytes: input.body.byteLength },
      validateBeforeUpload: (policy) => validateBeforeUpload(policy, input),
      storeAsset: () => uploadAsset(dependencies.store, input),
      validateAfterUpload: validateDimensions,
    });
  };
}
