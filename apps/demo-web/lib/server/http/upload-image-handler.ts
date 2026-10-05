import "server-only";

import type { AssetLake } from "@assetlake/core";
import {
  type ApiSuccess,
  type AssetLakeImageResult,
  IDEMPOTENCY_HEADER,
  IMAGE_PURPOSES,
  UPLOAD_FORM_FIELDS,
} from "@assetlake/core/contracts";
import { z } from "zod";

import { failure, toFailureResponse } from "../http-errors";
import type { UploadQuota } from "../quota";
import type { HandlerResult } from "../request-log";
import { sessionEntity } from "../session-token";
import {
  authenticate,
  type SessionVerifier,
  unauthenticated,
} from "./authenticate";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Boundaries, part headers, purpose and alt. The seeded policy stays the authoritative size limit.
export const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

export interface UploadDependencies {
  images: Pick<AssetLake["images"], "upload">;
  sessions: SessionVerifier;
  quota: Pick<UploadQuota, "reserve">;
  applicationId: string;
}

const uploadFormSchema = z.object({
  file: z.instanceof(File),
  purpose: z.enum(IMAGE_PURPOSES),
  alt: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((alt) => alt || undefined),
  idempotencyKey: z.string().min(1).max(200).optional(),
});

/** Rejects before the body is read: formData() would otherwise buffer whatever arrives. */
function rejectEnvelope(request: Request): Response | null {
  const contentType = request.headers.get("content-type")?.toLowerCase();
  if (!contentType?.startsWith("multipart/form-data"))
    return failure("BAD_REQUEST", "Send the image as multipart/form-data.");

  const declaredLength = request.headers.get("content-length");
  const contentLength = Number(declaredLength);
  if (!declaredLength || !Number.isSafeInteger(contentLength))
    return failure("BAD_REQUEST", "A Content-Length header is required.");
  if (contentLength > MAX_UPLOAD_REQUEST_BYTES)
    return failure("FILE_TOO_LARGE", "Images must be 5 MB or smaller.");
  return null;
}

async function readUploadForm(request: Request) {
  const formData = await request.formData().catch(() => null);
  return uploadFormSchema.safeParse({
    file: formData?.get(UPLOAD_FORM_FIELDS.file),
    purpose: formData?.get(UPLOAD_FORM_FIELDS.purpose),
    alt: formData?.get(UPLOAD_FORM_FIELDS.alt) ?? undefined,
    idempotencyKey: request.headers.get(IDEMPOTENCY_HEADER) ?? undefined,
  });
}

export async function uploadImage(
  request: Request,
  { images, sessions, quota, applicationId }: UploadDependencies,
): Promise<HandlerResult> {
  const session = await authenticate(request, sessions);
  if (!session) return unauthenticated();
  const actorId = session.userId;
  const respond = (response: Response, error?: unknown): HandlerResult => ({
    response,
    actorId,
    error,
  });

  const rejected = rejectEnvelope(request);
  if (rejected) return respond(rejected);

  const entity = sessionEntity(session);
  const reservation = await quota.reserve(entity);
  if (!reservation)
    return respond(
      failure("RATE_LIMITED", "Upload limit reached. Try again tomorrow."),
    );

  try {
    const form = await readUploadForm(request);
    if (!form.success) {
      reservation.release();
      const fields = form.error.issues.map((issue) => issue.path.join("."));
      return respond(
        failure("BAD_REQUEST", `Invalid upload fields: ${fields.join(", ")}.`),
      );
    }

    const { file, purpose, alt, idempotencyKey } = form.data;
    const image = await images.upload({
      body: new Uint8Array(await file.arrayBuffer()),
      filename: file.name || "upload",
      contentType: file.type,
      applicationId,
      purpose,
      entity,
      alt,
      idempotencyKey,
      actorId,
    });
    const payload: ApiSuccess<AssetLakeImageResult> = {
      success: true,
      data: image,
    };
    return respond(Response.json(payload, { status: 201 }));
  } catch (error) {
    reservation.release();
    return respond(toFailureResponse(error), error);
  }
}
