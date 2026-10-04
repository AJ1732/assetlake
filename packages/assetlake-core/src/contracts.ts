// Frozen public contract (tag @assetlake/core@0.1.0). B03, B04 and B05 build against these types in
// parallel; changing them is a contract change (docs/PLAN.md §3). Types and constants only.
import type {
  ImageCropMode,
  ImageFitMode,
  ImagePurpose,
  ImageStatus,
} from "@assetlake/sanity-schema/constants";

export type { ImageCropMode, ImageFitMode, ImagePurpose, ImageStatus };

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
  | "METADATA_CREATE_FAILED";

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
