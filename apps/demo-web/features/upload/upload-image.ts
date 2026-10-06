import {
  type ApiSuccess,
  type AssetLakeImageResult,
  IDEMPOTENCY_HEADER,
  type ImagePurpose,
  UPLOAD_FORM_FIELDS,
} from "@assetlake/core/contracts";

import type { UploadError } from "./upload-machine";

export const UPLOAD_ENDPOINT = "/api/assets/images";

// fetch() has no upload progress, so this uses XMLHttpRequest. The narrow type lets tests fake it.
export type UploadTransport = Pick<
  XMLHttpRequest,
  | "open"
  | "setRequestHeader"
  | "send"
  | "onload"
  | "onerror"
  | "status"
  | "responseText"
> & { upload: Pick<XMLHttpRequestUpload, "onprogress" | "onload"> };

export type UploadOutcome =
  | ApiSuccess<AssetLakeImageResult>
  | { success: false; error: UploadError };

/** What the person adds to a file before sending it. */
export interface UploadDetails {
  alt?: string;
  holdForReview?: boolean;
}

export interface UploadImageOptions extends UploadDetails {
  file: File;
  purpose: ImagePurpose;
  idempotencyKey: string;
  onProgress?: (percent: number) => void;
  onBytesSent?: () => void;
  createTransport?: () => UploadTransport;
}

export function buildUploadForm(
  file: File,
  purpose: ImagePurpose,
  { alt, holdForReview = false }: UploadDetails = {},
): FormData {
  const form = new FormData();
  form.append(UPLOAD_FORM_FIELDS.file, file, file.name);
  form.append(UPLOAD_FORM_FIELDS.purpose, purpose);
  const trimmedAlt = alt?.trim();
  if (trimmedAlt) form.append(UPLOAD_FORM_FIELDS.alt, trimmedAlt);
  if (holdForReview) form.append(UPLOAD_FORM_FIELDS.review, "on");
  return form;
}

const failure = (
  code: UploadError["code"],
  message: string,
): UploadOutcome => ({
  success: false,
  error: { code, message },
});

export function parseUploadResponse(
  status: number,
  responseText: string,
): UploadOutcome {
  let body: unknown;
  try {
    body = JSON.parse(responseText);
  } catch {
    return failure(
      "INVALID_RESPONSE",
      `The server answered ${status} without a JSON body.`,
    );
  }
  if (typeof body !== "object" || body === null || !("success" in body))
    return failure(
      "INVALID_RESPONSE",
      `The server answered ${status} with an unexpected body.`,
    );

  const envelope = body as UploadOutcome;
  if (envelope.success && status >= 200 && status < 300) return envelope;
  if (!envelope.success && envelope.error?.code) return envelope;
  return failure(
    "INVALID_RESPONSE",
    `The server answered ${status} with an unexpected body.`,
  );
}

export function uploadImage({
  file,
  purpose,
  alt,
  holdForReview,
  idempotencyKey,
  onProgress,
  onBytesSent,
  createTransport = () => new XMLHttpRequest(),
}: UploadImageOptions): Promise<UploadOutcome> {
  return new Promise((resolve) => {
    const request = createTransport();
    request.open("POST", UPLOAD_ENDPOINT);
    request.setRequestHeader(IDEMPOTENCY_HEADER, idempotencyKey);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0)
        onProgress?.((event.loaded / event.total) * 100);
    };
    request.upload.onload = () => onBytesSent?.();
    request.onload = () =>
      resolve(parseUploadResponse(request.status, request.responseText));
    request.onerror = () =>
      resolve(
        failure(
          "NETWORK_ERROR",
          "The upload did not reach the server. Check your connection and retry.",
        ),
      );
    request.send(buildUploadForm(file, purpose, { alt, holdForReview }));
  });
}
