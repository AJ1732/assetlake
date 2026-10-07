import { createHash } from "node:crypto";

import { fileTypeFromBuffer } from "file-type";

import type { EntityRef, ImageStatus } from "../contracts";
import {
  planDocumentIds,
  planPolicies,
  type SetupPlan,
} from "../setup/setup-plan";
import type {
  ApplicationPolicyRecord,
  ApplicationRecord,
  AssetLakeStore,
  ImageRecordView,
  ImageSourceView,
  NewImageRecord,
  PolicyRecord,
  PresetRecord,
  StoredAsset,
} from "../store/asset-lake-store";
import {
  type SetupMode,
  type SetupStore,
  toSetupResult,
} from "../store/setup-store";
import { readPngDimensions } from "./image-fixtures";

export type StoreOperation = keyof (AssetLakeStore & SetupStore);

const httpError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode });

export interface InMemoryStoreSeed {
  applications?: ApplicationRecord[];
  policies?: PolicyRecord[];
  presets?: PresetRecord[];
}

const sameEntity = (left: EntityRef | null | undefined, right: EntityRef) =>
  left?.type === right.type && left.id === right.id;

/**
 * Behaves like the Sanity adapter where the domain depends on it: identical bytes dedupe to one
 * asset id, creating an existing id reports "exists", and deleting a referenced asset is refused.
 * Presets are keyed by slug, so a setup plan's preset exists when its slug does.
 */
export class InMemoryStore implements AssetLakeStore, SetupStore {
  readonly applications = new Map<string, ApplicationRecord>();
  readonly policies = new Map<string, PolicyRecord>();
  readonly presets = new Map<string, PresetRecord>();
  readonly assets = new Map<string, StoredAsset>();
  readonly images = new Map<string, NewImageRecord>();
  private readonly counts = new Map<StoreOperation, number>();
  private readonly revisions = new Map<string, number>();
  private readonly failures = new Map<StoreOperation, Error>();
  private readonly remoteSources = new Map<string, Uint8Array>();

  constructor(seed: InMemoryStoreSeed = {}) {
    seed.applications?.forEach((record) =>
      this.applications.set(record.id, record),
    );
    seed.policies?.forEach((record) => this.policies.set(record.id, record));
    seed.presets?.forEach((record) => this.presets.set(record.slug, record));
  }

  /** Makes uploadImageAssetFromUrl find these bytes at this URL, like a reachable source. */
  serveRemote(url: string, bytes: Uint8Array): void {
    this.remoteSources.set(url, bytes);
  }

  failNext(
    operation: StoreOperation,
    error: Error = new Error(`${operation} failed`),
  ): void {
    this.failures.set(operation, error);
  }

  /** Calls to one store operation, or to all of them when none is named. */
  callCount(operation?: StoreOperation): number {
    if (operation) return this.counts.get(operation) ?? 0;
    return [...this.counts.values()].reduce((total, count) => total + count, 0);
  }

  private track(operation: StoreOperation): void {
    this.counts.set(operation, this.callCount(operation) + 1);
    const failure = this.failures.get(operation);
    if (failure) {
      this.failures.delete(operation);
      throw failure;
    }
  }

  private view(record: NewImageRecord): ImageRecordView {
    const asset = this.assets.get(record.assetId);
    if (!asset)
      throw new Error(`asset ${record.assetId} missing for ${record.id}`);
    return {
      id: record.id,
      revision: this.revisionOf(record.id),
      status: record.status,
      purpose: record.purpose,
      entity: record.entity ?? null,
      applicationId: record.applicationId,
      source: { asset: { _ref: record.assetId } },
      asset,
    };
  }

  private revisionOf(id: string): string {
    return `rev-${this.revisions.get(id) ?? 0}`;
  }

  /** An edit by someone else (alt text, Studio) that moves the record to a new revision. */
  touchImage(id: string): void {
    this.revisions.set(id, (this.revisions.get(id) ?? 0) + 1);
  }

  async findApplicationPolicy({
    applicationId,
    policyId,
  }: {
    applicationId: string;
    policyId?: string;
  }): Promise<ApplicationPolicyRecord | null> {
    this.track("findApplicationPolicy");
    const application = this.applications.get(applicationId);
    if (!application) return null;
    const effectivePolicyId = policyId ?? application.defaultPolicyId;
    return {
      applicationSlug: application.slug,
      policy: effectivePolicyId
        ? (this.policies.get(effectivePolicyId) ?? null)
        : null,
    };
  }

  async findPresetBySlug(slug: string) {
    this.track("findPresetBySlug");
    return this.presets.get(slug) ?? null;
  }

  async listPresets() {
    this.track("listPresets");
    return [...this.presets.values()].sort((left, right) =>
      left.slug.localeCompare(right.slug),
    );
  }

  async findImage(id: string) {
    this.track("findImage");
    const record = this.images.get(id);
    return record ? this.view(record) : null;
  }

  async findImageSource(id: string): Promise<ImageSourceView | null> {
    this.track("findImageSource");
    const record = this.images.get(id);
    if (!record) return null;
    const { source, asset } = this.view(record);
    return {
      source,
      width: asset.width,
      height: asset.height,
      lqip: asset.lqip,
    };
  }

  async findLatestReadyImage({
    entity,
    purpose,
  }: {
    entity: EntityRef;
    purpose: string;
  }) {
    this.track("findLatestReadyImage");
    const matches = [...this.images.values()]
      .filter(
        (record) =>
          sameEntity(record.entity, entity) &&
          record.purpose === purpose &&
          record.status === "ready",
      )
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
    return matches[0] ? this.view(matches[0]) : null;
  }

  async countImagesSince({
    applicationId,
    since,
  }: {
    applicationId: string;
    since: string;
  }) {
    this.track("countImagesSince");
    return [...this.images.values()].filter(
      (record) =>
        record.applicationId === applicationId && record.uploadedAt >= since,
    ).length;
  }

  async countImagesForEntity(entity: EntityRef) {
    this.track("countImagesForEntity");
    return [...this.images.values()].filter((record) =>
      sameEntity(record.entity, entity),
    ).length;
  }

  async uploadImageAsset(
    body: Uint8Array,
    { contentType }: { filename: string; contentType: string },
  ) {
    this.track("uploadImageAsset");
    return this.storeAsset(body, contentType);
  }

  // Mirrors Sanity's from-url endpoint: 400 for an unreachable source, 422 when the bytes are not
  // an image it can decode.
  async uploadImageAssetFromUrl(url: string) {
    this.track("uploadImageAssetFromUrl");
    const body = this.remoteSources.get(url);
    if (!body) throw httpError(400, "Asset URL returned HTTP 404.");
    const detected = await fileTypeFromBuffer(body);
    if (!detected?.mime.startsWith("image/"))
      throw httpError(422, "Invalid image, could not process");
    return this.storeAsset(body, detected.mime);
  }

  private storeAsset(body: Uint8Array, contentType: string): StoredAsset {
    const digest = createHash("sha1").update(body).digest("hex");
    const dimensions = readPngDimensions(body);
    const extension = contentType.split("/")[1] ?? "bin";
    const sizeLabel = dimensions
      ? `${dimensions.width}x${dimensions.height}`
      : "0x0";
    const asset: StoredAsset = {
      assetId: `image-${digest}-${sizeLabel}-${extension}`,
      url: `https://cdn.sanity.io/images/test/test/${digest}-${sizeLabel}.${extension}`,
      mimeType: contentType,
      size: body.byteLength,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      lqip: dimensions ? "data:image/png;base64,AAAA" : null,
      blurHash: null,
    };
    this.assets.set(asset.assetId, asset);
    return asset;
  }

  async createImage(record: NewImageRecord) {
    this.track("createImage");
    if (this.images.has(record.id)) return "exists" as const;
    this.images.set(record.id, record);
    return "created" as const;
  }

  async updateImageStatus(
    id: string,
    { status, ifRevision }: { status: ImageStatus; ifRevision: string },
  ) {
    this.track("updateImageStatus");
    const record = this.images.get(id);
    if (!record || this.revisionOf(id) !== ifRevision)
      return "conflict" as const;
    this.images.set(id, { ...record, status });
    this.touchImage(id);
    return "updated" as const;
  }

  async deleteImage(id: string) {
    this.track("deleteImage");
    this.images.delete(id);
  }

  async findMissingSetup(plan: SetupPlan) {
    this.track("findMissingSetup");
    return this.missingSetup(plan);
  }

  private missingSetup(plan: SetupPlan) {
    const present = new Set<string>();
    for (const policy of planPolicies(plan)) {
      if (this.policies.has(policy.id)) present.add(policy.id);
    }
    for (const preset of plan.presets) {
      if (this.presets.has(preset.slug)) present.add(preset.id);
    }
    if (this.applications.has(plan.application.id))
      present.add(plan.application.id);
    return planDocumentIds(plan).filter((id) => !present.has(id));
  }

  async ensureSetup(plan: SetupPlan, mode: SetupMode) {
    this.track("ensureSetup");
    const missing = new Set(this.missingSetup(plan));
    const shouldWrite = (id: string) => mode === "reset" || missing.has(id);

    for (const policy of planPolicies(plan)) {
      if (!shouldWrite(policy.id)) continue;
      const { id, allowedMimeTypes, maxFileSizeBytes, requiresReview } = policy;
      this.policies.set(id, {
        id,
        allowedMimeTypes,
        maxFileSizeBytes,
        minWidth: null,
        minHeight: null,
        maxWidth: null,
        maxHeight: null,
        requiresReview,
      });
    }
    for (const preset of plan.presets) {
      if (!shouldWrite(preset.id)) continue;
      this.presets.set(preset.slug, {
        slug: preset.slug,
        name: preset.name,
        width: preset.width ?? null,
        height: preset.height ?? null,
        fit: preset.fit ?? null,
        crop: preset.crop ?? null,
        quality: preset.quality ?? null,
        autoFormat: preset.autoFormat ?? null,
      });
    }
    if (shouldWrite(plan.application.id)) {
      this.applications.set(plan.application.id, {
        id: plan.application.id,
        slug: plan.application.slug,
        defaultPolicyId: plan.policy.id,
      });
    }
    return toSetupResult(planDocumentIds(plan), missing);
  }

  async deleteAsset(assetId: string) {
    this.track("deleteAsset");
    const referenced = [...this.images.values()].some(
      (record) => record.assetId === assetId,
    );
    if (referenced) return "referenced" as const;
    this.assets.delete(assetId);
    return "deleted" as const;
  }
}
