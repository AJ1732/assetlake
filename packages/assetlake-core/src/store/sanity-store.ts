import {
  createClient,
  type SanityClient,
  type SanityImageAssetDocument,
} from "@sanity/client";

import type { AssetLakeConfig } from "../client/config";
import { DOCUMENT_TYPES } from "../constants";
import { hasStatusCode } from "../errors/asset-lake-error";
import { planDocumentIds, type SetupPlan } from "../setup/setup-plan";
import type {
  AssetLakeStore,
  NewImageRecord,
  StoredAsset,
} from "./asset-lake-store";
import {
  APPLICATION_BY_ID_QUERY,
  COUNT_IMAGES_FOR_ENTITY_QUERY,
  COUNT_IMAGES_SINCE_QUERY,
  EXISTING_IDS_QUERY,
  IMAGE_BY_ID_QUERY,
  LATEST_READY_IMAGE_FOR_ENTITY_QUERY,
  POLICY_BY_ID_QUERY,
  PRESET_BY_SLUG_QUERY,
  PRESETS_QUERY,
} from "./queries";
import { toSetupDocuments } from "./setup-documents";
import { type SetupStore, toSetupResult } from "./setup-store";

const CONFLICT = 409;
// Sanity allows a from-url fetch up to 300s, which is also the client's default timeout, so the
// request would be cut off just as Sanity finishes.
const FROM_URL_TIMEOUT_MS = 330_000;

export function createSanityWriteClient(config: AssetLakeConfig): SanityClient {
  return createClient({
    projectId: config.projectId,
    dataset: config.dataset,
    apiVersion: config.apiVersion,
    token: config.token,
    useCdn: false,
    perspective: "published",
  });
}

function toStoredAsset(asset: SanityImageAssetDocument): StoredAsset {
  return {
    assetId: asset._id,
    url: asset.url,
    mimeType: asset.mimeType,
    size: asset.size,
    width: asset.metadata?.dimensions?.width ?? null,
    height: asset.metadata?.dimensions?.height ?? null,
    lqip: asset.metadata?.lqip ?? null,
    blurHash: asset.metadata?.blurHash ?? null,
  };
}

function toDocument(record: NewImageRecord) {
  return {
    _id: record.id,
    _type: DOCUMENT_TYPES.image,
    image: {
      _type: "image",
      asset: { _type: "reference", _ref: record.assetId },
    },
    application: { _type: "reference", _ref: record.applicationId },
    policy: { _type: "reference", _ref: record.policyId },
    purpose: record.purpose,
    ...(record.entity
      ? { entity: { type: record.entity.type, id: record.entity.id } }
      : {}),
    ...(record.alt ? { alt: record.alt } : {}),
    tags: record.tags,
    status: record.status,
    uploadedAt: record.uploadedAt,
    ...(record.idempotencyKeyHash
      ? { idempotencyKeyHash: record.idempotencyKeyHash }
      : {}),
  };
}

export function createSanityStore(
  client: SanityClient,
): AssetLakeStore & SetupStore {
  async function findMissingSetup(plan: SetupPlan): Promise<string[]> {
    const ids = planDocumentIds(plan);
    const found = new Set(
      await client.fetch<string[]>(EXISTING_IDS_QUERY, { ids }),
    );
    return ids.filter((id) => !found.has(id));
  }

  return {
    findApplication: (id) => client.fetch(APPLICATION_BY_ID_QUERY, { id }),
    findPolicy: (id) => client.fetch(POLICY_BY_ID_QUERY, { id }),
    findPresetBySlug: (slug) => client.fetch(PRESET_BY_SLUG_QUERY, { slug }),
    listPresets: () => client.fetch(PRESETS_QUERY),
    findImage: (id) => client.fetch(IMAGE_BY_ID_QUERY, { id }),
    findLatestReadyImage: ({ entity, purpose }) =>
      client.fetch(LATEST_READY_IMAGE_FOR_ENTITY_QUERY, {
        entityType: entity.type,
        entityId: entity.id,
        purpose,
      }),
    countImagesSince: ({ applicationId, since }) =>
      client.fetch(COUNT_IMAGES_SINCE_QUERY, { applicationId, since }),
    countImagesForEntity: (entity) =>
      client.fetch(COUNT_IMAGES_FOR_ENTITY_QUERY, {
        entityType: entity.type,
        entityId: entity.id,
      }),

    async uploadImageAsset(body, { filename, contentType }) {
      const asset = await client.assets.upload(
        "image",
        Buffer.from(body.buffer, body.byteOffset, body.byteLength),
        { filename, contentType },
      );
      return toStoredAsset(asset);
    },

    async uploadImageAssetFromUrl(url, { filename }) {
      const { document } = await client.request<{
        document: SanityImageAssetDocument;
      }>({
        method: "POST",
        url: `/assets/images/${client.config().dataset}/from-url`,
        body: filename ? { url, filename } : { url },
        timeout: FROM_URL_TIMEOUT_MS,
      });
      return toStoredAsset(document);
    },

    async createImage(record) {
      try {
        await client.create(toDocument(record));
        return "created";
      } catch (error) {
        if (hasStatusCode(error, CONFLICT)) return "exists";
        throw error;
      }
    },

    async deleteImage(id) {
      await client.delete(id);
    },

    async deleteAsset(assetId) {
      try {
        await client.delete(assetId);
        return "deleted";
      } catch (error) {
        if (hasStatusCode(error, CONFLICT)) return "referenced";
        throw error;
      }
    },

    findMissingSetup,

    // One transaction, so a partial setup (an application pointing at a missing policy) can't
    // happen. The id check runs first only to report created vs existing.
    async ensureSetup(plan, mode) {
      const missing = new Set(await findMissingSetup(plan));
      const transaction = client.transaction();
      for (const document of toSetupDocuments(plan)) {
        if (mode === "reset") {
          transaction.createOrReplace(document);
        } else {
          transaction.createIfNotExists(document);
        }
      }
      await transaction.commit({ visibility: "sync" });
      return toSetupResult(planDocumentIds(plan), missing);
    },
  };
}
