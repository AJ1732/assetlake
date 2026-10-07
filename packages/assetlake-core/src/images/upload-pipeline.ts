import type { Clock } from "../clock";
import type {
  AssetLakeErrorCode,
  AssetLakeImageResult,
  EntityRef,
  ImagePurpose,
} from "../contracts";
import { AssetLakeError, isAssetLakeError } from "../errors/asset-lake-error";
import type { LogEvent, LogFields, Logger, LogLevel } from "../logging/logger";
import type {
  AssetLakeStore,
  ImageRecordView,
  PolicyRecord,
  StoredAsset,
} from "../store/asset-lake-store";
import { compensateAsset } from "./compensate";
import {
  type IdGenerator,
  type ImageIdentity,
  resolveImageIdentity,
} from "./image-id";
import { normalizeImage, toImageResult } from "./normalize";

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
  /** Extra fields for the closing log line when this source's upload fails. */
  failureLogFields?(error: AssetLakeError): LogFields;
}

type UploadStage =
  | "lookup"
  | "before-upload"
  | "store"
  | "after-upload"
  | "record";

// The input broke a policy. Every other failure is ours or Sanity's, and is logged as an error.
const REJECTION_CODES: ReadonlySet<AssetLakeErrorCode> = new Set([
  "UNSUPPORTED_IMAGE_TYPE",
  "FILE_TOO_LARGE",
  "SIGNATURE_MISMATCH",
  "DIMENSIONS_OUT_OF_RANGE",
  "SOURCE_URL_NOT_ALLOWED",
]);

class UploadStepError extends Error {
  constructor(
    readonly stage: UploadStage,
    cause: unknown,
  ) {
    super(`Upload failed at ${stage}`, { cause });
  }
}

async function step<T>(
  stage: UploadStage,
  run: () => Promise<T> | T,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new UploadStepError(stage, error);
  }
}

function toAssetLakeError({ stage, cause }: UploadStepError): AssetLakeError {
  if (isAssetLakeError(cause)) return cause;
  return stage === "record"
    ? new AssetLakeError(
        "METADATA_CREATE_FAILED",
        "The image record could not be created.",
        { cause },
      )
    : new AssetLakeError("UPLOAD_FAILED", "The image could not be stored.", {
        cause,
      });
}

/** Logs the start now and returns the one function that logs how the attempt ended. */
function beginAttempt(logger: Logger, clock: Clock, context: LogFields) {
  const startedAt = clock.now().getTime();
  logger.log("info", "ASSET_UPLOAD_STARTED", context);
  return function close(
    level: LogLevel,
    event: LogEvent,
    fields: LogFields = {},
  ): void {
    logger.log(level, event, {
      ...context,
      ...fields,
      durationMs: clock.now().getTime() - startedAt,
    });
  };
}

async function resolvePolicy(
  store: AssetLakeStore,
  { applicationId, policyId }: UploadRequest,
): Promise<PolicyRecord> {
  const found = await store.findApplicationPolicy({ applicationId, policyId });
  if (!found) {
    throw new AssetLakeError(
      "APPLICATION_NOT_FOUND",
      `Unknown application ${applicationId}.`,
    );
  }
  if (!found.policy) {
    throw new AssetLakeError(
      "POLICY_NOT_FOUND",
      `No upload policy for application ${found.applicationSlug}.`,
    );
  }
  return found.policy;
}

type Lookup =
  | { replay: ImageRecordView }
  | { replay: null; policy: PolicyRecord };

/** Both reads at once. A replay wins even when the policy lookup fails or has changed since. */
async function lookUp(
  store: AssetLakeStore,
  request: UploadRequest,
  identity: ImageIdentity,
): Promise<Lookup> {
  const [replay, policy] = await Promise.allSettled([
    identity.idempotencyKeyHash ? store.findImage(identity.id) : null,
    resolvePolicy(store, request),
  ]);
  if (replay.status === "rejected") throw replay.reason;
  if (replay.value) return { replay: replay.value };
  if (policy.status === "rejected") throw policy.reason;
  return { replay: null, policy: policy.value };
}

/** "replayed" when a concurrent retry with the same key created the record first. */
async function recordImage(
  { store, logger, clock }: UploadDependencies,
  {
    request,
    identity,
    policy,
    asset,
  }: {
    request: UploadRequest;
    identity: ImageIdentity;
    policy: PolicyRecord;
    asset: StoredAsset;
  },
): Promise<{ outcome: "created" | "replayed"; result: AssetLakeImageResult }> {
  const status = policy.requiresReview ? "review" : "ready";
  const created = await store.createImage({
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
  if (created === "created") {
    return {
      outcome: "created",
      result: normalizeImage(identity.id, status, asset),
    };
  }

  const winner = await store.findImage(identity.id);
  if (!winner)
    throw new Error(`Image ${identity.id} reported as existing but not found`);
  await compensateAsset(store, logger, asset.assetId);
  return { outcome: "replayed", result: toImageResult(winner) };
}

/**
 * Look up the replay and policy, validate, store the asset, validate again, record it. Every
 * attempt logs one closing event, and an asset stored by a failed attempt is deleted again.
 */
export async function runUploadPipeline(
  dependencies: UploadDependencies,
  request: UploadRequest,
  source: UploadSource,
): Promise<AssetLakeImageResult> {
  const { store, logger, clock, ids } = dependencies;
  const identity = resolveImageIdentity(
    request.actorId,
    request.idempotencyKey,
    ids,
  );
  const close = beginAttempt(logger, clock, {
    imageId: identity.id,
    applicationId: request.applicationId,
    purpose: request.purpose,
    ...source.logFields,
  });
  let storedAssetId: string | undefined;

  try {
    const lookup = await step("lookup", () => lookUp(store, request, identity));
    if (lookup.replay) {
      close("info", "ASSET_UPLOAD_REPLAYED");
      return toImageResult(lookup.replay);
    }
    const { policy } = lookup;

    await step("before-upload", () => source.validateBeforeUpload(policy));
    const asset = await step("store", () => source.storeAsset());
    storedAssetId = asset.assetId;
    await step("after-upload", () => source.validateAfterUpload(policy, asset));
    const { outcome, result } = await step("record", () =>
      recordImage(dependencies, { request, identity, policy, asset }),
    );

    if (outcome === "replayed") {
      close("info", "ASSET_UPLOAD_REPLAYED");
    } else {
      close("info", "ASSET_UPLOAD_COMPLETED", {
        assetId: asset.assetId,
        status: result.status,
      });
    }
    return result;
  } catch (error) {
    if (!(error instanceof UploadStepError)) throw error;
    if (storedAssetId) await compensateAsset(store, logger, storedAssetId);
    const failure = toAssetLakeError(error);
    const rejected = REJECTION_CODES.has(failure.code);
    close(
      rejected ? "warn" : "error",
      rejected ? "ASSET_UPLOAD_REJECTED" : "ASSET_UPLOAD_FAILED",
      {
        code: failure.code,
        stage: error.stage,
        ...(storedAssetId ? { assetId: storedAssetId } : {}),
        ...source.failureLogFields?.(failure),
      },
    );
    throw failure;
  }
}
