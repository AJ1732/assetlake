"use client";

import { createImageUrls, type ImageUrls } from "@assetlake/core/url";
import type { SanityProject } from "@assetlake/sanity-schema/project";
import { useMemo } from "react";

import { AssetLakeImage } from "@/components/asset-lake-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { formatRelativeTime } from "./format-time";
import { LIVE_FEED_SIZE, type LiveImage } from "./live-query";
import { useLiveImages } from "./use-live-images";

const THUMBNAIL = {
  width: 256,
  height: 256,
  fit: "crop",
  autoFormat: true,
} as const;
const THUMBNAIL_SIZES = "(max-width: 640px) 45vw, 200px";
const SKELETON_TILES = 8;

export function LiveFeed({ target }: { target: SanityProject }) {
  const { projectId, dataset } = target;
  const { status, mode, images, error, updatedAt, refresh } =
    useLiveImages(target);
  const imageUrls = useMemo(
    () => createImageUrls({ projectId, dataset }),
    [projectId, dataset],
  );

  return (
    <section
      className="live"
      data-testid="live-feed"
      data-status={status}
      data-sanity-target={`${projectId}/${dataset}`}
      aria-labelledby="live-title"
    >
      <div className="live-toolbar">
        <h2 id="live-title" className="section-title">
          Latest {LIVE_FEED_SIZE} uploads
        </h2>
        <div className="live-controls">
          <span className="live-pill" data-mode={mode} role="status">
            <span aria-hidden="true" className="live-dot" />
            {mode === "live" ? "Live" : "Live paused, refresh to update"}
          </span>
          {updatedAt ? (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              Updated {new Date(updatedAt).toLocaleTimeString()}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => void refresh()}
            className="h-9 px-3"
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && status === "ready" ? (
        <p role="alert" className="upload-error">
          {error} Showing the last good result.
        </p>
      ) : null}

      {status === "loading" ? <LiveSkeleton /> : null}
      {status === "error" ? (
        <div role="alert" className="empty-state">
          <p>{error}</p>
          <Button
            type="button"
            onClick={() => void refresh()}
            className="h-10 px-4 text-sm"
          >
            Try again
          </Button>
        </div>
      ) : null}
      {status === "ready" && images.length === 0 ? (
        <p className="empty-state">
          No images yet. Upload one in the playground and it appears here.
        </p>
      ) : null}
      {status === "ready" && images.length > 0 ? (
        <ol className="live-grid">
          {images.map((image) => (
            <LiveTile
              key={image.id}
              image={image}
              imageUrls={imageUrls}
              now={updatedAt ?? 0}
            />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

// Relative times are measured from the last fetch, not from a clock read during render.
function LiveTile({
  image,
  imageUrls,
  now,
}: {
  image: LiveImage;
  imageUrls: ImageUrls;
  now: number;
}) {
  const uploaded = formatRelativeTime(image.uploadedAt, now);
  const responsive = imageUrls.buildResponsive(image.image, THUMBNAIL, {
    sizes: THUMBNAIL_SIZES,
    lqip: image.lqip,
  });

  return (
    <li className="live-tile" data-image-id={image.id}>
      <div className="live-frame">
        <AssetLakeImage
          image={responsive}
          alt={image.alt ?? `${image.purpose} image uploaded ${uploaded}`}
        />
      </div>
      <div className="live-meta">
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{image.purpose}</Badge>
          <Badge variant={image.status === "ready" ? "outline" : "secondary"}>
            {image.status}
          </Badge>
        </div>
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          {image.width && image.height
            ? `${image.width}×${image.height}`
            : "size unknown"}{" "}
          · <time dateTime={image.uploadedAt}>{uploaded}</time>
        </p>
      </div>
    </li>
  );
}

function LiveSkeleton() {
  return (
    <ol className="live-grid" aria-label="Loading images">
      {Array.from({ length: SKELETON_TILES }, (_, index) => (
        <li key={index} className="live-tile skeleton" aria-hidden="true">
          <div className="live-frame" />
          <div className="live-meta">
            <span className="skeleton-line" />
          </div>
        </li>
      ))}
    </ol>
  );
}
