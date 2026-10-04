import { fileTypeFromBuffer } from "file-type";

import { AssetLakeError } from "../errors/AssetLakeError";
import type { PolicyRecord, StoredAsset } from "../store/AssetLakeStore";

interface UploadCandidate {
  body: Uint8Array;
  contentType: string;
}

/**
 * Runs before any bytes reach Sanity. The declared type must be allowed AND match the file's
 * magic bytes, because a browser-supplied Content-Type is trivially spoofed (handoff §18.3).
 */
export async function validateBeforeUpload(
  policy: PolicyRecord,
  candidate: UploadCandidate,
): Promise<void> {
  if (!policy.allowedMimeTypes.includes(candidate.contentType)) {
    throw new AssetLakeError(
      "UNSUPPORTED_IMAGE_TYPE",
      `Only ${policy.allowedMimeTypes.join(", ")} images are accepted.`,
    );
  }

  if (candidate.body.byteLength > policy.maxFileSizeBytes) {
    throw new AssetLakeError(
      "FILE_TOO_LARGE",
      `Images must be ${policy.maxFileSizeBytes} bytes or smaller.`,
    );
  }

  const detected = await fileTypeFromBuffer(candidate.body);
  if (detected?.mime !== candidate.contentType) {
    throw new AssetLakeError(
      "SIGNATURE_MISMATCH",
      "The file contents do not match the declared image type.",
    );
  }
}

type Bound = {
  limit: number | null;
  actual: number | null;
  label: string;
  isViolated: (actual: number, limit: number) => boolean;
};

/** Dimensions are only known after Sanity analyses the upload, so this runs post-upload. */
export function validateDimensions(
  policy: PolicyRecord,
  asset: StoredAsset,
): void {
  const bounds: Bound[] = [
    {
      limit: policy.minWidth,
      actual: asset.width,
      label: "width at least",
      isViolated: (actual, limit) => actual < limit,
    },
    {
      limit: policy.minHeight,
      actual: asset.height,
      label: "height at least",
      isViolated: (actual, limit) => actual < limit,
    },
    {
      limit: policy.maxWidth,
      actual: asset.width,
      label: "width at most",
      isViolated: (actual, limit) => actual > limit,
    },
    {
      limit: policy.maxHeight,
      actual: asset.height,
      label: "height at most",
      isViolated: (actual, limit) => actual > limit,
    },
  ];

  const violated = bounds.find(
    ({ limit, actual, isViolated }) =>
      limit !== null && (actual === null || isViolated(actual, limit)),
  );
  if (violated) {
    throw new AssetLakeError(
      "DIMENSIONS_OUT_OF_RANGE",
      `Image ${violated.label} ${violated.limit}px is required.`,
    );
  }
}
