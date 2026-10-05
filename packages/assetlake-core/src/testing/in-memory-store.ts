import { createHash } from "node:crypto";

import type { EntityRef } from "../contracts";
import { planDocumentIds, type SetupPlan } from "../setup/setup-plan";
import type {
  ApplicationRecord,
  AssetLakeStore,
  ImageRecordView,
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

type Failure = "uploadImageAsset" | "createImage" | "deleteAsset";

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
  readonly calls: Record<string, number> = {};
  private readonly failures = new Map<Failure, Error>();

  constructor(seed: InMemoryStoreSeed = {}) {
    seed.applications?.forEach((record) =>
      this.applications.set(record.id, record),
    );
    seed.policies?.forEach((record) => this.policies.set(record.id, record));
    seed.presets?.forEach((record) => this.presets.set(record.slug, record));
  }

  failNext(
    operation: Failure,
    error: Error = new Error(`${operation} failed`),
  ): void {
    this.failures.set(operation, error);
  }

  private track(operation: string): void {
    this.calls[operation] = (this.calls[operation] ?? 0) + 1;
    const failure = this.failures.get(operation as Failure);
    if (failure) {
      this.failures.delete(operation as Failure);
      throw failure;
    }
  }

  private view(record: NewImageRecord): ImageRecordView {
    const asset = this.assets.get(record.assetId);
    if (!asset)
      throw new Error(`asset ${record.assetId} missing for ${record.id}`);
    return {
      id: record.id,
      status: record.status,
      purpose: record.purpose,
      entity: record.entity ?? null,
      applicationId: record.applicationId,
      source: { asset: { _ref: record.assetId } },
      asset,
    };
  }

  async findApplication(id: string) {
    return this.applications.get(id) ?? null;
  }

  async findPolicy(id: string) {
    return this.policies.get(id) ?? null;
  }

  async findPresetBySlug(slug: string) {
    this.track("findPresetBySlug");
    return this.presets.get(slug) ?? null;
  }

  async listPresets() {
    return [...this.presets.values()].sort((left, right) =>
      left.slug.localeCompare(right.slug),
    );
  }

  async findImage(id: string) {
    const record = this.images.get(id);
    return record ? this.view(record) : null;
  }

  async findLatestReadyImage({
    entity,
    purpose,
  }: {
    entity: EntityRef;
    purpose: string;
  }) {
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
    return [...this.images.values()].filter(
      (record) =>
        record.applicationId === applicationId && record.uploadedAt >= since,
    ).length;
  }

  async countImagesForEntity(entity: EntityRef) {
    return [...this.images.values()].filter((record) =>
      sameEntity(record.entity, entity),
    ).length;
  }

  async uploadImageAsset(
    body: Uint8Array,
    { contentType }: { filename: string; contentType: string },
  ) {
    this.track("uploadImageAsset");
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

  async deleteImage(id: string) {
    this.images.delete(id);
  }

  async findMissingSetup(plan: SetupPlan) {
    const present = new Set<string>();
    if (this.policies.has(plan.policy.id)) present.add(plan.policy.id);
    for (const preset of plan.presets) {
      if (this.presets.has(preset.slug)) present.add(preset.id);
    }
    if (this.applications.has(plan.application.id))
      present.add(plan.application.id);
    return planDocumentIds(plan).filter((id) => !present.has(id));
  }

  async ensureSetup(plan: SetupPlan, mode: SetupMode) {
    const missing = new Set(await this.findMissingSetup(plan));
    const shouldWrite = (id: string) => mode === "reset" || missing.has(id);

    if (shouldWrite(plan.policy.id)) {
      const { id, allowedMimeTypes, maxFileSizeBytes, requiresReview } =
        plan.policy;
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
