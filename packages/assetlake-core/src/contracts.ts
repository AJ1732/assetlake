// Public contract: every consumer compiles against it, so a change here is a breaking change for
// them. Types and constants only. 0.2.0 moved the domain constants here from
// @assetlake/sanity-schema, so the npm package has no Studio dependency.
import type {
  ImageCropMode,
  ImageFitMode,
  ImagePurpose,
  ImageStatus,
} from "./constants";

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

// Hotspot and crop travel with the asset reference so preset URLs respect the editor's focal point.
export interface ImageSource {
  asset: { _ref: string };
  hotspot?: { x: number; y: number; height: number; width: number };
  crop?: { top: number; bottom: number; left: number; right: number };
}

/** A stored image plus its source, so callers can build any preset URL without another read. */
export interface AssetLakeImageWithSource extends AssetLakeImageResult {
  source: ImageSource;
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

// A review decides between these two. Upload never returns "rejected", so AssetLakeImageResult
// keeps its narrower status and a transition reports the full one.
export type ReviewOutcomeStatus = Extract<ImageStatus, "ready" | "rejected">;

export interface TransitionStatusInput {
  id: string;
  to: ReviewOutcomeStatus;
  reviewer: { id: string };
}

export interface ImageStatusTransition {
  id: string;
  from: ImageStatus;
  to: ReviewOutcomeStatus;
  outcome: "applied" | "unchanged";
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
  | "SOURCE_FETCH_FAILED"
  | "INVALID_STATUS_TRANSITION";

// HTTP envelope: produced by demo-web's route handlers, consumed by its UI.
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
  review: "review",
} as const;
export const IDEMPOTENCY_HEADER = "Idempotency-Key";
export const RESPONSIVE_WIDTHS = [256, 512, 768] as const;
