// Public contract. Changing it is a contract change (docs/PLAN.md §3). Types and constants only.
// 0.2.0 moved the domain constants here from @assetlake/sanity-schema, so the npm package has no
// Studio dependency.
import type { ImageCropMode, ImageFitMode, ImagePurpose } from "./constants";

export * from "./constants";

export interface EntityRef {
  type: string;
  id: string;
}

export interface UploadImageInput {
  body: Uint8Array;
  filename: string;
  contentType: string;
  applicationId: string;
  policyId?: string;
  purpose: ImagePurpose;
  entity?: EntityRef;
  alt?: string;
  tags?: string[];
  idempotencyKey?: string;
  actorId: string;
}

// Sanity fetches the URL itself (Assets API from-url), so the bytes never pass through the caller.
// Only hosts listed in config.remoteUploads.allowedHosts are accepted.
export interface UploadImageFromUrlInput extends Omit<
  UploadImageInput,
  "body" | "filename" | "contentType"
> {
  url: string;
  filename?: string;
}

export interface AssetLakeImageResult {
  id: string;
  assetId: string;
  url: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  lqip: string | null;
  blurHash: string | null;
  status: "ready" | "review";
}

export interface ImageTransform {
  width?: number;
  height?: number;
  quality?: number;
  fit?: ImageFitMode;
  crop?: ImageCropMode;
  autoFormat?: boolean;
}

export interface ResponsiveImage {
  src: string;
  srcSet: string;
  sizes: string;
  width: number | null;
  height: number | null;
  lqip: string | null;
}

export interface DeleteImageInput {
  id: string;
  actorEntity: EntityRef;
}

export type AssetLakeErrorCode =
  | "UNSUPPORTED_IMAGE_TYPE"
  | "FILE_TOO_LARGE"
  | "SIGNATURE_MISMATCH"
  | "DIMENSIONS_OUT_OF_RANGE"
  | "APPLICATION_NOT_FOUND"
  | "POLICY_NOT_FOUND"
  | "PRESET_NOT_FOUND"
  | "PRESET_INVALID"
  | "IMAGE_NOT_FOUND"
  | "FORBIDDEN"
  | "UPLOAD_FAILED"
  | "METADATA_CREATE_FAILED"
  | "SOURCE_URL_NOT_ALLOWED"
  | "SOURCE_FETCH_FAILED";

// HTTP envelope: produced by demo-web route handlers (B03), consumed by the demo UI (B04).
export type ApiErrorCode =
  | AssetLakeErrorCode
  | "UNAUTHENTICATED"
  | "RATE_LIMITED"
  | "BAD_REQUEST";
export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = {
  success: false;
  error: { code: ApiErrorCode; message: string };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const UPLOAD_FORM_FIELDS = {
  file: "file",
  purpose: "purpose",
  alt: "alt",
} as const;
export const IDEMPOTENCY_HEADER = "Idempotency-Key";
export const RESPONSIVE_WIDTHS = [256, 512, 768] as const;
