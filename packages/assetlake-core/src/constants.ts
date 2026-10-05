// No imports on purpose: contracts.ts re-exports this file, and contracts ships to browsers through
// @assetlake/core/url and the console. @assetlake/sanity-schema builds its Studio schema from it.

export const DOCUMENT_TYPES = {
  application: "assetLakeApplication",
  policy: "assetLakePolicy",
  preset: "assetLakePreset",
  image: "assetLakeImage",
} as const;

// Verified 2026-10-04 against https://www.sanity.io/docs/apis-and-sdks/image-urls
export const IMAGE_FIT_MODES = [
  "clip",
  "crop",
  "fill",
  "fillmax",
  "max",
  "scale",
  "min",
] as const;
export const IMAGE_CROP_MODES = [
  "top",
  "bottom",
  "left",
  "right",
  "center",
  "focalpoint",
  "entropy",
] as const;

// The image pipeline only transforms these formats, so a policy may not allow anything else.
export const TRANSFORMABLE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/tiff",
] as const;

export const IMAGE_PURPOSES = [
  "avatar",
  "cover",
  "thumbnail",
  "project",
  "content",
  "other",
] as const;
export const IMAGE_STATUSES = [
  "processing",
  "ready",
  "review",
  "rejected",
  "failed",
] as const;
export const APPLICATION_ENVIRONMENTS = [
  "development",
  "staging",
  "production",
  "demo",
] as const;

export const PRESET_QUALITY_RANGE = { min: 1, max: 100 } as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];
export type ImageFitMode = (typeof IMAGE_FIT_MODES)[number];
export type ImageCropMode = (typeof IMAGE_CROP_MODES)[number];
export type TransformableImageMimeType =
  (typeof TRANSFORMABLE_IMAGE_MIME_TYPES)[number];
export type ImagePurpose = (typeof IMAGE_PURPOSES)[number];
export type ImageStatus = (typeof IMAGE_STATUSES)[number];
export type ApplicationEnvironment = (typeof APPLICATION_ENVIRONMENTS)[number];
