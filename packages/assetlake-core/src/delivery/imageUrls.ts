import {
  createImageUrlBuilder,
  type SanityImageSource,
} from "@sanity/image-url";

import {
  type ImageTransform,
  RESPONSIVE_WIDTHS,
  type ResponsiveImage,
} from "../contracts";

export type { SanityImageSource };

export interface ImageUrlTarget {
  projectId: string;
  dataset: string;
}

export interface ResponsiveOptions {
  sizes?: string;
  lqip?: string | null;
  /** Original dimensions, used for aspect ratio when the transform does not fix both sides. */
  dimensions?: { width: number | null; height: number | null };
}

const DEFAULT_SIZES = "(max-width: 768px) 100vw, 768px";

/** Bounded candidate widths (handoff §14.4), capped at the transform width so nothing upscales. */
export function responsiveWidths(transformWidth: number | undefined): number[] {
  if (!transformWidth) return [...RESPONSIVE_WIDTHS];
  const fitting = RESPONSIVE_WIDTHS.filter((width) => width <= transformWidth);
  return fitting.length > 0 ? fitting : [transformWidth];
}

function aspectRatio(
  transform: ImageTransform,
  dimensions: ResponsiveOptions["dimensions"],
): number | null {
  if (transform.width && transform.height)
    return transform.height / transform.width;
  if (dimensions?.width && dimensions.height)
    return dimensions.height / dimensions.width;
  return null;
}

/** Browser-safe: needs only the public project id and dataset, never a token or client. */
export function createImageUrls(target: ImageUrlTarget) {
  const builder = createImageUrlBuilder({
    projectId: target.projectId,
    dataset: target.dataset,
  });

  function buildUrl(
    source: SanityImageSource,
    transform: ImageTransform,
  ): string {
    let image = builder.image(source);
    if (transform.width) image = image.width(transform.width);
    if (transform.height) image = image.height(transform.height);
    if (transform.fit) image = image.fit(transform.fit);
    if (transform.crop) image = image.crop(transform.crop);
    if (transform.quality) image = image.quality(transform.quality);
    if (transform.autoFormat) image = image.auto("format");
    return image.url();
  }

  function buildResponsive(
    source: SanityImageSource,
    transform: ImageTransform,
    options: ResponsiveOptions = {},
  ): ResponsiveImage {
    const ratio = aspectRatio(transform, options.dimensions);
    const heightFor = (width: number) =>
      ratio === null ? undefined : Math.round(width * ratio);
    const candidates = responsiveWidths(transform.width).map((width) => ({
      width,
      url: buildUrl(source, {
        ...transform,
        width,
        height: transform.height ? heightFor(width) : undefined,
      }),
    }));
    const largest = candidates.at(-1)!;

    return {
      src: largest.url,
      srcSet: candidates.map(({ url, width }) => `${url} ${width}w`).join(", "),
      sizes: options.sizes ?? DEFAULT_SIZES,
      width: largest.width,
      height: heightFor(largest.width) ?? null,
      lqip: options.lqip ?? null,
    };
  }

  return { buildUrl, buildResponsive };
}

export type ImageUrls = ReturnType<typeof createImageUrls>;
