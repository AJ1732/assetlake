import { basename } from "node:path";

import {
  type AssetLake,
  type EntityRef,
  IMAGE_PURPOSES,
  type ImagePurpose,
} from "@assetlake/core";
import { fileTypeFromBuffer } from "file-type";

import { UsageError } from "../cli-errors";
import type { CommandResult } from "../output";

export interface UploadOptions {
  file: string;
  applicationId: string;
  purpose: string;
  entityType?: string;
  entityId?: string;
  alt?: string;
  tags: string[];
  preset?: string;
}

export interface UploadDependencies {
  assetLake: AssetLake;
  readFile(path: string): Promise<Uint8Array>;
}

const CLI_ACTOR = "assetlake-cli";

function toPurpose(value: string): ImagePurpose {
  if (!(IMAGE_PURPOSES as readonly string[]).includes(value)) {
    throw new UsageError(
      `Unknown --purpose "${value}". Use one of: ${IMAGE_PURPOSES.join(", ")}.`,
    );
  }
  return value as ImagePurpose;
}

function toEntity(options: UploadOptions): EntityRef | undefined {
  const { entityType, entityId } = options;
  if (!entityType && !entityId) return undefined;
  if (!entityType || !entityId) {
    throw new UsageError("Pass --entity-type and --entity-id together.");
  }
  return { type: entityType, id: entityId };
}

// The declared type comes from the bytes, never the extension. Non-images stop here, before any
// request; core then checks the bytes again against the application's policy.
async function detectImageType(
  body: Uint8Array,
  filename: string,
): Promise<string> {
  const detected = await fileTypeFromBuffer(body);
  if (!detected?.mime.startsWith("image/")) {
    throw new Error(
      `${filename} is not an image (detected ${detected?.mime ?? "unknown type"}).`,
    );
  }
  return detected.mime;
}

export async function upload(
  deps: UploadDependencies,
  options: UploadOptions,
): Promise<CommandResult> {
  const purpose = toPurpose(options.purpose);
  const entity = toEntity(options);
  const filename = basename(options.file);
  const body = await deps.readFile(options.file);
  const contentType = await detectImageType(body, filename);

  const image = await deps.assetLake.images.upload({
    body,
    filename,
    contentType,
    applicationId: options.applicationId,
    purpose,
    entity,
    alt: options.alt,
    tags: options.tags,
    actorId: entity?.id ?? CLI_ACTOR,
  });
  if (!options.preset) return { exitCode: 0, output: image };

  const presetUrl = await deps.assetLake.images.url(image.id, {
    preset: options.preset,
  });
  return {
    exitCode: 0,
    output: { ...image, preset: options.preset, presetUrl },
  };
}
