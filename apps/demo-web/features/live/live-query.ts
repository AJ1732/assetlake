import type { SanityImageSource } from "@assetlake/core/url";

export const LIVE_FEED_SIZE = 24;

export interface LiveImage {
  id: string;
  purpose: string;
  status: string;
  uploadedAt: string;
  alt: string | null;
  image: SanityImageSource;
  width: number | null;
  height: number | null;
  lqip: string | null;
}

export const LIVE_IMAGES_QUERY = `*[_type == "assetLakeImage" && defined(image.asset)] | order(uploadedAt desc)[0...${LIVE_FEED_SIZE}]{
  "id": _id,
  purpose,
  status,
  uploadedAt,
  "alt": coalesce(alt, null),
  image,
  "width": image.asset->metadata.dimensions.width,
  "height": image.asset->metadata.dimensions.height,
  "lqip": image.asset->metadata.lqip
}`;
