import { DOCUMENT_TYPES } from "@assetlake/sanity-schema/constants";

// Mirrors IMAGE_VIEW_PROJECTION in @assetlake/core/src/store/queries.ts. URL, size and dimensions
// live on the dereferenced sanity.imageAsset, never on the AssetLake record (handoff §8.4).
const IMAGE_ROW_FIELDS = `
  "id": _id,
  status,
  purpose,
  uploadedAt,
  "application": application->{"id": _id, name},
  "entity": select(defined(entity.id) => entity{type, id}, null),
  "source": image{asset{_ref}, hotspot, crop},
  "asset": image.asset->{
    "assetId": _id,
    url,
    mimeType,
    size,
    "width": metadata.dimensions.width,
    "height": metadata.dimensions.height,
    "lqip": metadata.lqip
  }`;

// Breakdowns and the byte sum cover at most this many rows; `total` always counts every record.
export const IMAGE_LIST_LIMIT = 500;

export const IMAGE_LIST_QUERY = `{
  "total": count(*[_type == "${DOCUMENT_TYPES.image}"]),
  "items": *[_type == "${DOCUMENT_TYPES.image}"] | order(uploadedAt desc)[0...${IMAGE_LIST_LIMIT}]{${IMAGE_ROW_FIELDS}
  }
}`;

export const IMAGE_DETAIL_PROJECTION = `{${IMAGE_ROW_FIELDS},
  alt,
  tags,
  "policyName": policy->name,
  "originalFilename": image.asset->originalFilename
}`;

// Ordered by slug, not width: editing a width must not reorder the list under the cursor.
export const PRESETS_QUERY = `*[_type == "${DOCUMENT_TYPES.preset}"] | order(slug.current asc){
  "id": _id,
  "slug": slug.current,
  name,
  width,
  height,
  fit,
  crop,
  quality,
  autoFormat
}`;
