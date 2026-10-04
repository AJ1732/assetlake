import type { SanityImageSource } from "@assetlake/core/url";

import {
  formatBytes,
  formatDimensions,
  formatExactBytes,
  formatLabel,
  formatTimestamp,
  MISSING,
} from "./format";
import type { ImageDetailRow, ImageRow } from "./types";

export interface ImageCardModel {
  id: string;
  /** Null when the asset reference is gone: render a placeholder, never a broken URL. */
  source: SanityImageSource | null;
  lqip: string | null;
  status: string | null;
  statusLabel: string;
  purposeLabel: string;
  applicationLabel: string;
  dimensionsLabel: string;
  mimeLabel: string;
  sizeLabel: string;
  uploadedLabel: string;
  altText: string;
}

export interface ImageDetailModel extends ImageCardModel {
  assetId: string;
  originalUrl: string | null;
  exactSizeLabel: string;
  entityLabel: string;
  policyLabel: string;
  filenameLabel: string;
  tags: string[];
  width: number | null;
  height: number | null;
}

const hasAsset = (row: ImageRow) => Boolean(row.asset?.assetId && row.source);

export function toImageCard(row: ImageRow, timeZone?: string): ImageCardModel {
  const { asset } = row;
  const purposeLabel = formatLabel(row.purpose);
  return {
    id: row.id,
    source: hasAsset(row) ? row.source : null,
    lqip: asset?.lqip ?? null,
    status: row.status,
    statusLabel: formatLabel(row.status),
    purposeLabel,
    applicationLabel:
      row.application?.name || row.application?.id || "No application",
    dimensionsLabel: formatDimensions(asset?.width, asset?.height),
    mimeLabel: asset?.mimeType ?? MISSING,
    sizeLabel: formatBytes(asset?.size),
    uploadedLabel: formatTimestamp(row.uploadedAt, timeZone),
    altText: `${purposeLabel} image ${row.id}`,
  };
}

export function toImageDetail(
  row: ImageDetailRow,
  timeZone?: string,
): ImageDetailModel {
  const card = toImageCard(row, timeZone);
  const entity = row.entity;
  return {
    ...card,
    altText: row.alt || card.altText,
    assetId: row.asset?.assetId ?? MISSING,
    originalUrl: row.asset?.url ?? null,
    exactSizeLabel: formatExactBytes(row.asset?.size),
    entityLabel:
      entity?.type && entity.id ? `${entity.type} · ${entity.id}` : MISSING,
    policyLabel: row.policyName ?? "Application default",
    filenameLabel: row.originalFilename ?? MISSING,
    tags: row.tags ?? [],
    width: row.asset?.width ?? null,
    height: row.asset?.height ?? null,
  };
}

/** Example image for the Presets screen: the chosen one, else the newest ready image, else any image. */
export function pickExampleImage(
  rows: readonly ImageRow[],
  selectedId: string | null,
): ImageRow | null {
  const usable = rows.filter(hasAsset);
  return (
    usable.find((row) => row.id === selectedId) ??
    usable.find((row) => row.status === "ready") ??
    usable[0] ??
    null
  );
}
