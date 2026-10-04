import type { Metadata } from "next";

import { FlowDiagram } from "@/components/flow-diagram";
import { PageHeader } from "@/components/page-header";
import { PublicImagesNotice } from "@/components/public-images-notice";

export const metadata: Metadata = {
  title: "Architecture",
  description:
    "The delivery problem behind AssetLake, the final flow, and its known limitations.",
};

const OPTIONS = [
  {
    name: "Railway Storage Buckets",
    verdict: "Private only",
    detail:
      "S3-compatible and cheap, but buckets are private. Public delivery means presigned URLs or proxying every image through the backend.",
  },
  {
    name: "Cloudflare R2",
    verdict: "Needs DNS on Cloudflare",
    detail:
      "Production caching needs a custom domain in a Cloudflare zone. Partial CNAME setup is Business or Enterprise only, and r2.dev is for development.",
  },
  {
    name: "Sanity image assets",
    verdict: "Public CDN, no DNS change",
    detail:
      "Upload once through an authenticated backend. Sanity stores the asset, transforms it on request, and serves it from cdn.sanity.io.",
  },
] as const;

const LIMITATIONS = [
  ["Public images only.", "Standard Content Lake assets are not private."],
  [
    "Not S3-compatible.",
    "AssetLake is an image service abstraction, not an S3 protocol endpoint.",
  ],
  [
    "No custom asset domain by default.",
    "Images use cdn.sanity.io; custom asset domains are an Enterprise add-on.",
  ],
  [
    "Deletion is not instant revocation.",
    "CDN caches may keep serving a previously cached image for a while.",
  ],
  [
    "Different cost profile.",
    "Sanity is chosen for storage, transforms, and delivery together, not for the lowest raw storage price.",
  ],
  [
    "Workflows is early access.",
    "The review workflow is optional and not part of this demo's core path.",
  ],
  [
    "Review is not confidentiality.",
    "Putting an image in review does not hide an asset URL that already exists.",
  ],
  ["Images only.", "There is no generic file or video pipeline."],
  [
    "No anonymous uploads.",
    "The demo needs a passcode session, and quotas cap uploads per session and per day.",
  ],
  [
    "No invented analytics.",
    "Pages show only data that Sanity documents or APIs actually return.",
  ],
] as const;

export default function ArchitecturePage() {
  return (
    <div className="architecture">
      <PageHeader
        eyebrow="Architecture"
        title="Where image delivery should not live."
      >
        <p>
          Campus by Rise runs its frontend, backend, WebSocket server, database,
          and Redis on Railway. User images need durable storage and fast public
          delivery. The question behind AssetLake: can Sanity be the image
          layer, so the app servers stay out of the read path?
        </p>
      </PageHeader>

      <section aria-labelledby="options-title">
        <h2 id="options-title" className="section-title">
          Three ways to serve a public avatar
        </h2>
        <ol className="option-grid">
          {OPTIONS.map((option, index) => (
            <li
              key={option.name}
              className="panel option"
              data-chosen={index === OPTIONS.length - 1 || undefined}
            >
              <p className="eyebrow">{option.verdict}</p>
              <h3 className="option-title">{option.name}</h3>
              <p className="text-sm text-muted-foreground">{option.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="flow-title">
        <h2 id="flow-title" className="section-title">
          The final flow
        </h2>
        <FlowDiagram />
        <ul className="plain-list text-sm">
          <li>
            The backend authenticates, checks type, size, and magic bytes,
            enforces quotas, then calls Sanity with a server-only token.
          </li>
          <li>
            The app stores an AssetLake image id, not a URL. Presets in Sanity
            turn that id into transform URLs at render time.
          </li>
          <li>
            Browsers request those URLs from cdn.sanity.io. The app origin
            serves zero image bytes.
          </li>
        </ul>
      </section>

      <section aria-labelledby="limits-title">
        <h2 id="limits-title" className="section-title">
          Known limitations
        </h2>
        <PublicImagesNotice />
        <ol className="limitations">
          {LIMITATIONS.map(([title, detail]) => (
            <li key={title}>
              <strong>{title}</strong>{" "}
              <span className="text-muted-foreground">{detail}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
