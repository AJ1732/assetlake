import { DOCUMENT_TYPES } from "@assetlake/sanity-schema/constants";
import {
  createClient,
  type SanityClient,
  type SanityImageAssetDocument,
} from "@sanity/client";

import type { AssetLakeConfig } from "../client/config";
import { hasStatusCode } from "../errors/asset-lake-error";
import type {
  AssetLakeStore,
  NewImageRecord,
  StoredAsset,
} from "./asset-lake-store";
import {
  APPLICATION_BY_ID_QUERY,
  COUNT_IMAGES_FOR_ENTITY_QUERY,
  COUNT_IMAGES_SINCE_QUERY,
  IMAGE_BY_ID_QUERY,
  LATEST_READY_IMAGE_FOR_ENTITY_QUERY,
  POLICY_BY_ID_QUERY,
  PRESET_BY_SLUG_QUERY,
  PRESETS_QUERY,
} from "./queries";

const CONFLICT = 409;

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

export function createSanityStore(client: SanityClient): AssetLakeStore {
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
  };
}
