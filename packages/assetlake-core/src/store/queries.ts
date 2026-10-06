import { DOCUMENT_TYPES } from "../constants";

const IMAGE_VIEW_PROJECTION = `{
  "id": _id,
  "revision": _rev,
  status,
  purpose,
  "entity": select(defined(entity.id) => entity{type, id}, null),
  "applicationId": application._ref,
  "source": image{asset{_ref}, hotspot, crop},
  "asset": image.asset->{
    "assetId": _id,
    url,
    mimeType,
    size,
    "width": metadata.dimensions.width,
    "height": metadata.dimensions.height,
    "lqip": metadata.lqip,
    "blurHash": metadata.blurHash
  }
}`;

const PRESET_PROJECTION = `{
  "slug": slug.current,
  name,
  width,
  height,
  fit,
  crop,
  quality,
  autoFormat
}`;

export const APPLICATION_BY_ID_QUERY = `*[_type == "${DOCUMENT_TYPES.application}" && _id == $id][0]{
  "id": _id,
  "slug": slug.current,
  "defaultPolicyId": defaultPolicy._ref
}`;

export const POLICY_BY_ID_QUERY = `*[_type == "${DOCUMENT_TYPES.policy}" && _id == $id][0]{
  "id": _id,
  allowedMimeTypes,
  maxFileSizeBytes,
  minWidth,
  minHeight,
  maxWidth,
  maxHeight,
  "requiresReview": coalesce(requiresReview, false)
}`;

export const PRESET_BY_SLUG_QUERY = `*[_type == "${DOCUMENT_TYPES.preset}" && slug.current == $slug][0]${PRESET_PROJECTION}`;

export const PRESETS_QUERY = `*[_type == "${DOCUMENT_TYPES.preset}"] | order(slug.current asc)${PRESET_PROJECTION}`;

export const IMAGE_BY_ID_QUERY = `*[_type == "${DOCUMENT_TYPES.image}" && _id == $id][0]${IMAGE_VIEW_PROJECTION}`;

export const LATEST_READY_IMAGE_FOR_ENTITY_QUERY = `*[
  _type == "${DOCUMENT_TYPES.image}"
  && entity.type == $entityType
  && entity.id == $entityId
  && purpose == $purpose
  && status == "ready"
] | order(uploadedAt desc)[0]${IMAGE_VIEW_PROJECTION}`;

export const COUNT_IMAGES_SINCE_QUERY = `count(*[
  _type == "${DOCUMENT_TYPES.image}" && application._ref == $applicationId && uploadedAt >= $since
])`;

export const EXISTING_IDS_QUERY = `*[_id in $ids]._id`;

export const COUNT_IMAGES_FOR_ENTITY_QUERY = `count(*[
  _type == "${DOCUMENT_TYPES.image}" && entity.type == $entityType && entity.id == $entityId
])`;
