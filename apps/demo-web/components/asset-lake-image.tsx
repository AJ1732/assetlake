import type { ResponsiveImage } from "@assetlake/core/contracts";
import { cn } from "cn";
import type { CSSProperties } from "react";

interface AssetLakeImageProps {
  image: ResponsiveImage;
  alt: string;
  className?: string;
  /** Above-the-fold image the page is about (the avatar): load eagerly at high priority. */
  priority?: boolean;
}

/** The only place an AssetLake image becomes an <img>. The LQIP fills the box only when Sanity returned one. */
export function AssetLakeImage({
  image,
  alt,
  className,
  priority = false,
}: AssetLakeImageProps) {
  const placeholder: CSSProperties | undefined = image.lqip
    ? {
        backgroundImage: `url("${image.lqip}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Q9: the browser must request cdn.sanity.io directly, never /_next/image.
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={image.sizes}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      style={placeholder}
      className={cn("bg-muted", className)}
      data-assetlake-image=""
    />
  );
}
