import type { AssetLakeImageResult, UploadImageInput } from "../contracts";
import { AssetLakeError, isAssetLakeError } from "../errors/AssetLakeError";
import type { Logger } from "../logging/logger";
import {
  validateBeforeUpload,
  validateDimensions,
} from "../policies/validateUpload";
import type {
  AssetLakeStore,
  PolicyRecord,
  StoredAsset,
} from "../store/AssetLakeStore";
import { compensateAsset } from "./compensate";
import { type IdGenerator, resolveImageIdentity } from "./imageId";
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

async function resolvePolicy(
  store: AssetLakeStore,
  input: UploadImageInput,
): Promise<PolicyRecord> {
  const application = await store.findApplication(input.applicationId);
  if (!application) {
    throw new AssetLakeError(
      "APPLICATION_NOT_FOUND",
      `Unknown application ${input.applicationId}.`,
    );
  }
  const policyId = input.policyId ?? application.defaultPolicyId;
  const policy = policyId ? await store.findPolicy(policyId) : null;
  if (!policy) {
    throw new AssetLakeError(
      "POLICY_NOT_FOUND",
      `No upload policy for application ${application.slug}.`,
    );
  }
  return policy;
}

async function uploadAsset(
  store: AssetLakeStore,
  input: UploadImageInput,
): Promise<StoredAsset> {
  try {
    return await store.uploadImageAsset(input.body, {
      filename: input.filename,
      contentType: input.contentType,
    });
  } catch (error) {
    throw new AssetLakeError(
      "UPLOAD_FAILED",
      "The image could not be stored.",
      { cause: error },
    );
  }
}

/** Handoff §11.3 sequence, plus idempotent replay (Q10) and reference-aware compensation. */
export function createUploadImage({
  store,
  logger,
  clock,
  ids,
}: UploadDependencies) {
  return async function uploadImage(
    input: UploadImageInput,
  ): Promise<AssetLakeImageResult> {
    const startedAt = clock.now().getTime();
    const elapsed = () => clock.now().getTime() - startedAt;
    const identity = resolveImageIdentity(
      input.actorId,
      input.idempotencyKey,
      ids,
    );
    const context = {
      imageId: identity.id,
      applicationId: input.applicationId,
      purpose: input.purpose,
      bytes: input.body.byteLength,
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

    const policy = await resolvePolicy(store, input);
    try {
      await validateBeforeUpload(policy, input);
    } catch (error) {
      const code = isAssetLakeError(error) ? error.code : "UNEXPECTED";
      logger.log("warn", "ASSET_UPLOAD_REJECTED", {
        ...context,
        code,
        durationMs: elapsed(),
      });
      throw error;
    }

    const asset = await uploadAsset(store, input);
    const status = policy.requiresReview ? "review" : "ready";

    try {
      validateDimensions(policy, asset);
      const outcome = await store.createImage({
        id: identity.id,
        assetId: asset.assetId,
        applicationId: input.applicationId,
        policyId: policy.id,
        purpose: input.purpose,
        entity: input.entity,
        alt: input.alt,
        tags: input.tags ?? [],
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
  };
}
