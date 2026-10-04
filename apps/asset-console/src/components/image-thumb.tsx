import type { ImageTransform, SanityImageSource } from "@assetlake/core/url";
import { Card, Text } from "@sanity/ui";

import { imageUrls } from "../sanity-target";
import { imageFrame } from "./styles";

interface ImageThumbProps {
  source: SanityImageSource | null;
  transform: ImageTransform;
  lqip: string | null;
  alt: string;
  size?: number;
}

/** A fixed-size square so grids never reflow while thumbnails load; the LQIP fills the wait. */
export function ImageThumb({
  source,
  transform,
  lqip,
  alt,
  size = 96,
}: ImageThumbProps) {
  if (!source)
    return (
      <Card
        tone="caution"
        radius={2}
        style={{
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Text size={0}>No asset</Text>
      </Card>
    );

  return (
    <img
      src={imageUrls.buildUrl(source, transform)}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{
        ...imageFrame,
        width: size,
        height: size,
        objectFit: "cover",
        backgroundImage: lqip ? `url(${lqip})` : undefined,
        backgroundSize: "cover",
      }}
    />
  );
}
