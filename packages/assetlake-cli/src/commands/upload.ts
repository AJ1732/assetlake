import { basename } from "node:path";

import {
  type AssetLake,
  type AssetLakeImageResult,
  IMAGE_PURPOSES,
  type ImagePurpose,
} from "@assetlake/core";
import { fileTypeFromBuffer } from "file-type";

import { UsageError } from "../cli-errors";
import type { CommandResult } from "../output";
import { toEntity } from "./entity";

export interface UploadOptions {
  /** A local path, or an https URL that Sanity fetches itself. */
  source: string;
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

export const isRemoteSource = (source: string) => /^https?:\/\//i.test(source);

function toPurpose(value: string): ImagePurpose {
  if (!(IMAGE_PURPOSES as readonly string[]).includes(value)) {
    throw new UsageError(
      `Unknown --purpose "${value}". Use one of: ${IMAGE_PURPOSES.join(", ")}.`,
    );
  }
  return value as ImagePurpose;
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

function filenameFromUrl(url: string): string | undefined {
  const last = new URL(url).pathname.split("/").pop();
  return last ? decodeURIComponent(last) : undefined;
}

export async function upload(
  deps: UploadDependencies,
  options: UploadOptions,
): Promise<CommandResult> {
  const entity = toEntity(options);
  const common = {
    applicationId: options.applicationId,
    purpose: toPurpose(options.purpose),
    entity,
    alt: options.alt,
    tags: options.tags,
    actorId: entity.id,
  };

  let image: AssetLakeImageResult;
  if (isRemoteSource(options.source)) {
    if (!/^https:\/\//i.test(options.source) || !URL.canParse(options.source))
      throw new UsageError("Only https URLs can be uploaded from the web.");
    image = await deps.assetLake.images.uploadFromUrl({
      ...common,
      url: options.source,
      filename: filenameFromUrl(options.source),
    });
  } else {
    const filename = basename(options.source);
    const body = await deps.readFile(options.source);
    image = await deps.assetLake.images.upload({
      ...common,
      body,
      filename,
      contentType: await detectImageType(body, filename),
    });
  }

  if (!options.preset) return { exitCode: 0, output: image };
  const presetUrl = await deps.assetLake.images.url(image.id, {
    preset: options.preset,
  });
  return {
    exitCode: 0,
    output: { ...image, preset: options.preset, presetUrl },
  };
}
