import Link from "next/link";

import { FlowDiagram } from "@/components/flow-diagram";
import { PageHeader } from "@/components/page-header";
import { PublicImagesNotice } from "@/components/public-images-notice";

const DESTINATIONS = [
  {
    href: "/playground",
    title: "Playground",
    body: "Enter the demo passcode, change the avatar, and see it return from cdn.sanity.io in four preset sizes.",
  },
  {
    href: "/live",
    title: "Live feed",
    body: "The newest uploads, read from the public dataset with no token. New images appear without a reload.",
  },
  {
    href: "/architecture",
    title: "Architecture",
    body: "Why private buckets and DNS migrations pushed this toward Sanity, and the limits that come with it.",
  },
  {
    href: "/docs",
    title: "Docs",
    body: "Set up @assetlake/core on a server, upload, and render responsive images in the browser.",
  },
] as const;

const PRIMITIVES = [
  ["Content Lake image assets", "durable storage, metadata, LQIP"],
  ["Image pipeline", "resize, crop, hotspot, quality, format"],
  ["Asset CDN", "global delivery at cdn.sanity.io"],
  ["Live Content API", "realtime reads with no token"],
] as const;

export default function HomePage() {
  return (
    <div className="home">
      <PageHeader
        eyebrow="Image infrastructure layer · powered by Sanity"
        title={
          <>
            Upload once. <em>Serve every size</em> from cdn.sanity.io.
          </>
        }
      >
        <p>
          AssetLake is a drop-in image asset storage, transformation, and CDN
          delivery layer powered by Sanity. Your backend handles the upload.
          Browsers fetch every transformed size directly from Sanity&apos;s
          Asset CDN, so your app servers never proxy an image.
        </p>
      </PageHeader>

      <FlowDiagram />

      <PublicImagesNotice />

      <nav aria-label="Explore the demo">
        <ul className="destination-grid">
          {DESTINATIONS.map((destination) => (
            <li key={destination.href}>
              <Link href={destination.href} className="destination">
                <span className="destination-title">{destination.title}</span>
                <span className="text-sm text-muted-foreground">
                  {destination.body}
                </span>
                <span aria-hidden="true" className="destination-arrow">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="primitives-title" className="primitives">
        <h2 id="primitives-title" className="section-title">
          Sanity primitives it uses
        </h2>
        <dl>
          {PRIMITIVES.map(([name, role]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd className="font-mono text-xs text-muted-foreground">
                {role}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
