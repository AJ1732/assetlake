import type { UploadError } from "./upload-machine";

// Mirrors the seeded "public-profile-images" policy so users get instant feedback. The route
// handler and core re-check everything; these values are a UI hint, not the security boundary.
export const UPLOAD_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

export const ACCEPT_ATTRIBUTE = UPLOAD_LIMITS.mimeTypes.join(",");

export function checkUploadLimits(
  file: Pick<File, "size" | "type">,
): UploadError | null {
  if (!(UPLOAD_LIMITS.mimeTypes as readonly string[]).includes(file.type))
    return {
      code: "UNSUPPORTED_IMAGE_TYPE",
      message: "Choose a JPEG, PNG, or WebP image.",
    };
  if (file.size > UPLOAD_LIMITS.maxBytes)
    return {
      code: "FILE_TOO_LARGE",
      message: "Images must be 5\u00A0MB or smaller.",
    };
  return null;
}
