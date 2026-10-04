import type { CSSProperties } from "react";

import { AssetLakeImage } from "@/components/asset-lake-image";
import { CopyButton } from "@/components/copy-button";
import { HostChip } from "@/components/host-chip";

import type { PresetCell } from "../profile/load-playground.server";

const SRCSET_CAP = 768;

function describeTransform(cell: Extract<PresetCell, { status: "ready" }>) {
  const { width, height, fit, quality } = cell.transform;
  const size = [width, height].filter(Boolean).join("×");
  return [size, fit, quality ? `q${quality}` : null]
    .filter(Boolean)
    .join(" · ");
}

export function PresetMatrix({
  cells,
  error,
}: {
  cells: PresetCell[];
  error: string | null;
}) {
  return (
    <section
      className="matrix"
      aria-labelledby="matrix-title"
      data-testid="preset-matrix"
    >
      <div className="matrix-head">
        <h2 id="matrix-title" className="section-title">
          One asset, every preset
        </h2>
        <p className="text-sm text-muted-foreground">
          Each tile is a transform URL on the same stored image. Nothing was
          resized or stored again; Sanity&apos;s image pipeline builds each size
          on request and the Asset CDN caches it.
        </p>
      </div>

      {error ? (
        <p role="alert" className="upload-error">
          {error}
        </p>
      ) : null}

      {cells.length === 0 && !error ? (
        <p className="empty-state">
          Upload an avatar to see it in every preset.
        </p>
      ) : (
        <ol className="matrix-grid">
          {cells.map((cell, index) => (
            <li
              key={cell.slug}
              className="matrix-cell"
              style={{ "--index": index } as CSSProperties}
              data-preset={cell.slug}
            >
              {cell.status === "ready" ? (
                <>
                  <div className="matrix-frame">
                    <AssetLakeImage
                      image={cell.image}
                      alt={`Avatar in the ${cell.name} preset`}
                    />
                  </div>
                  <div className="matrix-caption">
                    <p className="font-medium">
                      {cell.name}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {cell.slug}
                      </span>
                    </p>
                    <p className="font-mono text-xs text-muted-foreground tabular-nums">
                      {describeTransform(cell)}
                    </p>
                    {(cell.transform.width ?? 0) > SRCSET_CAP ? (
                      <p className="text-xs text-muted-foreground">
                        srcSet capped at {SRCSET_CAP}w by design; the copied URL
                        is the full preset.
                      </p>
                    ) : null}
                    <div className="matrix-actions">
                      <HostChip url={cell.url} />
                      <CopyButton value={cell.url} label="Copy URL" />
                    </div>
                  </div>
                </>
              ) : (
                <p role="alert" className="upload-error">
                  <span className="font-mono text-xs">{cell.slug}</span>{" "}
                  {cell.message}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
