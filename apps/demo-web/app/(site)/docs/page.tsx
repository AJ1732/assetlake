import type { Metadata } from "next";

import { CodeBlock } from "@/components/code-block";
import { PageHeader } from "@/components/page-header";
import { PublicImagesNotice } from "@/components/public-images-notice";

export const metadata: Metadata = {
  title: "Docs",
  description: "Set up @assetlake/core, upload an image, and render responsive images from cdn.sanity.io.",
};

// Snippets mirror packages/assetlake-core/README.md, whose calls are covered by core's tests.
const SNIPPETS = [
  {
    id: "setup",
    title: "1. Create the server client",
    body: "Server only. The write token never gets a NEXT_PUBLIC_ prefix and never reaches a browser.",
    caption: "lib/server/asset-lake.ts",
    code: `import { createAssetLake } from "@assetlake/core";

export const assetLake = createAssetLake({
  projectId: "oshzwvjy",
  dataset: process.env.SANITY_DATASET!,
  apiVersion: "2026-10-04",
  token: process.env.SANITY_WRITE_TOKEN!, // server only
});`,
  },
  {
    id: "upload",
    title: "2. Upload from your route handler",
    body: "Core checks the declared type, size, and magic bytes against the policy before anything reaches Sanity. A repeated Idempotency-Key returns the existing record.",
    caption: "app/api/assets/images/route.ts",
    code: `const image = await assetLake.images.upload({
  body: new Uint8Array(await file.arrayBuffer()),
  filename: file.name,
  contentType: file.type,
  applicationId: "assetlake-application-campus-demo",
  purpose: "avatar",
  entity: { type: "user", id: session.userId },
  actorId: session.userId,
  idempotencyKey: request.headers.get("Idempotency-Key") ?? undefined,
});`,
  },
  {
    id: "deliver",
    title: "3. Resolve preset URLs on the server",
    body: "Presets live in Sanity, so an edited preset applies without a redeploy (cached for 60 seconds). responsive() uses the stored hotspot and returns a bounded srcSet of 256, 512, and 768w.",
    caption: "server component",
    code: `const avatarUrl = await assetLake.images.url(image.id, { preset: "avatar" });
const card = await assetLake.images.responsive(image.id, { preset: "card" });
// card: { src, srcSet, sizes, width, height, lqip }`,
  },
  {
    id: "render",
    title: "4. Render a plain <img>",
    body: "No image optimizer in between: the browser requests cdn.sanity.io directly. Show the LQIP while it loads, if Sanity returned one.",
    caption: "AssetLakeImage.tsx",
    code: `<img
  src={card.src}
  srcSet={card.srcSet}
  sizes={card.sizes}
  width={card.width ?? undefined}
  height={card.height ?? undefined}
  alt="Project cover"
  style={card.lqip ? { backgroundImage: \`url("\${card.lqip}")\` } : undefined}
/>`,
  },
  {
    id: "browser",
    title: "Building URLs in the browser",
    body: "@assetlake/core/url is browser safe: it needs only the public project id and dataset. Prefer server-resolved URLs for stored records so hotspots apply.",
    caption: "client component",
    code: `import { createImageUrls } from "@assetlake/core/url";

const urls = createImageUrls({ projectId: "oshzwvjy", dataset: "production" });
const src = urls.buildUrl(image.assetId, {
  width: 256,
  height: 256,
  fit: "crop",
  autoFormat: true,
});`,
  },
  {
    id: "http",
    title: "HTTP contract",
    body: "The demo backend's upload endpoint. Every response uses the same envelope.",
    caption: "POST /api/assets/images",
    code: `multipart/form-data: file, purpose ("avatar"), alt (optional)
Idempotency-Key: <uuid>            optional, safe retries

201 { "success": true,  "data": { id, assetId, url, mimeType, size, width, height, aspectRatio, lqip, blurHash, status } }
4xx { "success": false, "error": { "code": "FILE_TOO_LARGE", "message": "..." } }

401 UNAUTHENTICATED · 400 UNSUPPORTED_IMAGE_TYPE · 413 FILE_TOO_LARGE · 429 RATE_LIMITED`,
  },
] as const;

export default function DocumentationPage() {
  return (
    <div className="docs">
      <PageHeader eyebrow="Developer guide" title="Four calls from upload to <img>.">
        <p>
          <code>@assetlake/core</code> is framework neutral. The server entry holds the write token;
          <code> @assetlake/core/url</code> and <code>@assetlake/core/contracts</code> are safe to ship
          to browsers.
        </p>
      </PageHeader>
      <PublicImagesNotice />
      <nav aria-label="On this page" className="docs-toc">
        <ol>
          {SNIPPETS.map((snippet) => (
            <li key={snippet.id}>
              <a href={`#${snippet.id}`}>{snippet.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      {SNIPPETS.map((snippet) => (
        <section key={snippet.id} id={snippet.id} aria-labelledby={`${snippet.id}-title`} className="docs-section">
          <h2 id={`${snippet.id}-title`} className="section-title">
            {snippet.title}
          </h2>
          <p className="text-muted-foreground">{snippet.body}</p>
          <CodeBlock code={snippet.code} caption={snippet.caption} />
        </section>
      ))}
    </div>
  );
}
