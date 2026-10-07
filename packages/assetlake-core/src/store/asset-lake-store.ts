import type {
  EntityRef,
  ImagePurpose,
  ImageSource,
  ImageStatus,
} from "../contracts";

// Port between the domain and Sanity. The Sanity adapter owns every GROQ query and mutation;
// the in-memory adapter backs the gate tests. Domain code never sees @sanity/client.

export interface ApplicationRecord {
  id: string;
  slug: string;
  defaultPolicyId: string | null;
}

export interface PolicyRecord {
  id: string;
  allowedMimeTypes: string[];
  maxFileSizeBytes: number;
  minWidth: number | null;
  minHeight: number | null;
  maxWidth: number | null;
  maxHeight: number | null;
  requiresReview: boolean;
}

export interface PresetRecord {
  slug: string;
  name: string;
  width: number | null;
  height: number | null;
  fit: string | null;
  crop: string | null;
  quality: number | null;
  autoFormat: boolean | null;
}

export interface StoredAsset {
  assetId: string;
  url: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  lqip: string | null;
  blurHash: string | null;
}

export interface ImageRecordView {
  id: string;
  /** Sanity's _rev: a status change is written only if the record is still at this revision. */
  revision: string;
  status: ImageStatus;
  purpose: ImagePurpose;
  entity: EntityRef | null;
  applicationId: string;
  source: ImageSource;
  asset: StoredAsset;
}

/** What URL building needs, without the record's status, entity or the full asset document. */
export interface ImageSourceView {
  source: ImageSource;
  width: number | null;
  height: number | null;
  lqip: string | null;
}

export interface ApplicationPolicyRecord {
  applicationSlug: string;
  /** The requested policy, else the application's default; null when neither exists. */
  policy: PolicyRecord | null;
}

export interface NewImageRecord {
  id: string;
  assetId: string;
  applicationId: string;
  policyId: string;
  purpose: ImagePurpose;
  entity?: EntityRef;
  alt?: string;
  tags: string[];
  status: ImageStatus;
  uploadedAt: string;
  idempotencyKeyHash?: string;
}

export interface UploadAssetOptions {
  filename: string;
  contentType: string;
}

export interface AssetLakeStore {
  findApplicationPolicy(query: {
    applicationId: string;
    policyId?: string;
  }): Promise<ApplicationPolicyRecord | null>;
  findPresetBySlug(slug: string): Promise<PresetRecord | null>;
  listPresets(): Promise<PresetRecord[]>;
  findImage(id: string): Promise<ImageRecordView | null>;
  findImageSource(id: string): Promise<ImageSourceView | null>;
  findLatestReadyImage(query: {
    entity: EntityRef;
    purpose: ImagePurpose;
  }): Promise<ImageRecordView | null>;
  countImagesSince(query: {
    applicationId: string;
    since: string;
  }): Promise<number>;
  countImagesForEntity(entity: EntityRef): Promise<number>;
  uploadImageAsset(
    body: Uint8Array,
    options: UploadAssetOptions,
  ): Promise<StoredAsset>;
  /** Sanity fetches the URL (Assets API from-url). Rejects with the upstream statusCode. */
  uploadImageAssetFromUrl(
    url: string,
    options: { filename?: string },
  ): Promise<StoredAsset>;
  /** "exists" when a document with record.id is already present (idempotent replay race). */
  createImage(record: NewImageRecord): Promise<"created" | "exists">;
  /** "conflict" when the record changed since `ifRevision` was read; nothing is written then. */
  updateImageStatus(
    id: string,
    change: { status: ImageStatus; ifRevision: string },
  ): Promise<"updated" | "conflict">;
  deleteImage(id: string): Promise<void>;
  /** "referenced" when Sanity refuses the delete because another document still points at it. */
  deleteAsset(assetId: string): Promise<"deleted" | "referenced">;
}
