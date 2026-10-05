"use client";

import type { AssetLakeImageResult } from "@assetlake/core/contracts";
import { createImageUrls } from "@assetlake/core/url";
import { type FormEvent, useState } from "react";

type Status = { kind: "idle" | "busy" } | { kind: "error"; message: string };

async function readImage(response: Response): Promise<AssetLakeImageResult> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "Upload failed.");
  return body as AssetLakeImageResult;
}

export function UploadForm(props: { projectId: string; dataset: string }) {
  const urls = createImageUrls(props);
  const [image, setImage] = useState<AssetLakeImageResult | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function run(request: () => Promise<Response>) {
    setStatus({ kind: "busy" });
    try {
      setImage(await readImage(await request()));
      setStatus({ kind: "idle" });
    } catch (error) {
      setStatus({ kind: "error", message: (error as Error).message });
    }
  }

  function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = new FormData(event.currentTarget);
    void run(() => fetch("/api/images", { method: "POST", body }));
  }

  function uploadUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = new FormData(event.currentTarget).get("url");
    void run(() =>
      fetch("/api/images/from-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      }),
    );
  }

  async function remove() {
    if (!image) return;
    await fetch(`/api/images/${image.id}`, { method: "DELETE" });
    setImage(null);
  }

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <form onSubmit={uploadFile}>
        <input name="file" type="file" accept="image/*" required />
        <button disabled={status.kind === "busy"}>Upload file</button>
      </form>
      <form onSubmit={uploadUrl}>
        <input name="url" type="url" placeholder="https://..." required />
        <button disabled={status.kind === "busy"}>Upload from URL</button>
      </form>
      {status.kind === "error" && <p role="alert">{status.message}</p>}
      {image && (
        <figure style={{ margin: 0 }}>
          {/* A cdn.sanity.io URL built in the browser, no token involved. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls.buildUrl(image.assetId, {
              width: 640,
              height: 360,
              fit: "crop",
              autoFormat: true,
            })}
            alt=""
            width={640}
            height={360}
            style={{ maxWidth: "100%", height: "auto" }}
          />
          <figcaption>
            {image.id} ({image.width}x{image.height}, {image.mimeType}){" "}
            <button type="button" onClick={remove}>
              Delete
            </button>
          </figcaption>
        </figure>
      )}
    </section>
  );
}
