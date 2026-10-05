import type {
  AssetLakeImageResult,
  EntityRef,
  ImagePurpose,
} from "../contracts";
import { AssetLakeError, isAssetLakeError } from "../errors/asset-lake-error";
import type { LogFields, Logger } from "../logging/logger";
import type {
  AssetLakeStore,
  PolicyRecord,
  StoredAsset,
} from "../store/asset-lake-store";
import { compensateAsset } from "./compensate";
import { type IdGenerator, resolveImageIdentity } from "./image-id";
import { normalizeImage, toResultStatus } from "./normalize";

export interface Clock {
  now(): Date;
}

export interface UploadDependencies {
  store: AssetLakeStore;
  logger: Logger;
  clock: Clock;
  ids: IdGenerator;
}

/** What every upload shares, whatever the bytes come from. */
export interface UploadRequest {
  applicationId: string;
  policyId?: string;
  purpose: ImagePurpose;
  entity?: EntityRef;
  alt?: string;
  tags?: string[];
  idempotencyKey?: string;
  actorId: string;
}

/**
 * Where the bytes come from. Byte uploads validate before anything reaches Sanity; URL uploads can
 * only check the URL first, because Sanity fetches the bytes, so their policy checks run after.
 */
export interface UploadSource {
  logFields: LogFields;
  validateBeforeUpload(policy: PolicyRecord): Promise<void> | void;
  storeAsset(): Promise<StoredAsset>;
  validateAfterUpload(policy: PolicyRecord, asset: StoredAsset): void;
}

async function resolvePolicy(
  store: AssetLakeStore,
  request: UploadRequest,
): Promise<PolicyRecord> {
  const application = await store.findApplication(request.applicationId);
  if (!application) {
    throw new AssetLakeError(
      "APPLICATION_NOT_FOUND",
      `Unknown application ${request.applicationId}.`,
    );
  }
  const policyId = request.policyId ?? application.defaultPolicyId;
  const policy = policyId ? await store.findPolicy(policyId) : null;
  if (!policy) {
    throw new AssetLakeError(
      "POLICY_NOT_FOUND",
      `No upload policy for application ${application.slug}.`,
    );
  }
  return policy;
}

/** Handoff §11.3 sequence, plus idempotent replay (Q10) and reference-aware compensation. */
export async function runUploadPipeline(
  { store, logger, clock, ids }: UploadDependencies,
  request: UploadRequest,
  source: UploadSource,
): Promise<AssetLakeImageResult> {
  const startedAt = clock.now().getTime();
  const elapsed = () => clock.now().getTime() - startedAt;
  const identity = resolveImageIdentity(
    request.actorId,
    request.idempotencyKey,
    ids,
  );
  const context = {
    imageId: identity.id,
    applicationId: request.applicationId,
    purpose: request.purpose,
    ...source.logFields,
  };
  logger.log("info", "ASSET_UPLOAD_STARTED", context);

  if (identity.idempotencyKeyHash) {
    const existing = await store.findImage(identity.id);
    if (existing) {
      logger.log("info", "ASSET_UPLOAD_REPLAYED", {
        ...context,
        durationMs: elapsed(),
      });
      return normalizeImage(
        existing.id,
        toResultStatus(existing.status),
        existing.asset,
      );
    }
  }

  const policy = await resolvePolicy(store, request);
  try {
    await source.validateBeforeUpload(policy);
  } catch (error) {
    const code = isAssetLakeError(error) ? error.code : "UNEXPECTED";
    logger.log("warn", "ASSET_UPLOAD_REJECTED", {
      ...context,
      code,
      durationMs: elapsed(),
    });
    throw error;
  }

  const asset = await source.storeAsset();
  const status = policy.requiresReview ? "review" : "ready";

  try {
    source.validateAfterUpload(policy, asset);
    const outcome = await store.createImage({
      id: identity.id,
      assetId: asset.assetId,
      applicationId: request.applicationId,
      policyId: policy.id,
      purpose: request.purpose,
      entity: request.entity,
      alt: request.alt,
      tags: request.tags ?? [],
      status,
      uploadedAt: clock.now().toISOString(),
      idempotencyKeyHash: identity.idempotencyKeyHash,
    });

    if (outcome === "exists") {
      const winner = await store.findImage(identity.id);
      if (!winner)
        throw new Error(
          `Image ${identity.id} reported as existing but not found`,
        );
      await compensateAsset(store, logger, asset.assetId);
      logger.log("info", "ASSET_UPLOAD_REPLAYED", {
        ...context,
        durationMs: elapsed(),
      });
      return normalizeImage(
        winner.id,
        toResultStatus(winner.status),
        winner.asset,
      );
    }
  } catch (error) {
    await compensateAsset(store, logger, asset.assetId);
    if (isAssetLakeError(error)) {
      logger.log("warn", "ASSET_UPLOAD_REJECTED", {
        ...context,
        code: error.code,
        stage: "after-upload",
        assetId: asset.assetId,
        durationMs: elapsed(),
      });
      throw error;
    }
    logger.log("error", "ASSET_METADATA_CREATE_FAILED", {
      ...context,
      assetId: asset.assetId,
      durationMs: elapsed(),
    });
    throw new AssetLakeError(
      "METADATA_CREATE_FAILED",
      "The image record could not be created.",
      { cause: error },
    );
  }

  logger.log("info", "ASSET_UPLOAD_COMPLETED", {
    ...context,
    assetId: asset.assetId,
    status,
    durationMs: elapsed(),
  });
  return normalizeImage(identity.id, status, asset);
}
