import type { ImagePurpose, ImageStatus } from "@assetlake/core/contracts";
import type { SanityImageSource } from "@assetlake/core/url";

// Shapes returned by the GROQ projections in ./queries. Every field is nullable because the
// projections dereference image.asset-> and application->, which can be missing.

export interface AssetRow {
  assetId: string;
  url: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  lqip: string | null;
}

export interface ImageRow {
  id: string;
  status: ImageStatus | null;
  purpose: ImagePurpose | null;
  uploadedAt: string | null;
  application: { id: string; name: string | null } | null;
  entity: { type: string | null; id: string | null } | null;
  source: SanityImageSource | null;
  asset: AssetRow | null;
}

export interface ImageListResult {
  total: number;
  items: ImageRow[];
}

export interface ImageDetailRow extends ImageRow {
  alt: string | null;
  tags: string[] | null;
  policyName: string | null;
  originalFilename: string | null;
}

export interface PresetFields {
  width?: number | null;
  height?: number | null;
  quality?: number | null;
  fit?: string | null;
  crop?: string | null;
  autoFormat?: boolean | null;
}

/** The raw preset document as useDocument returns it (draft overlaid on published). */
export interface PresetDocument extends PresetFields {
  _id: string;
  _type: string;
  name?: string | null;
}

export interface PresetRow extends PresetFields {
  id: string;
  slug: string | null;
  name: string | null;
}
