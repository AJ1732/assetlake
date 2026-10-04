import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { PublicImagesNotice } from "@/components/public-images-notice";
import { LiveFeed } from "@/features/live/live-feed";

export const metadata: Metadata = {
  title: "Live",
  description:
    "The newest AssetLake uploads, read live from Sanity's public dataset with no token.",
};

export default function LivePage() {
  return (
    <div className="live-page">
      <PageHeader eyebrow="Live feed" title="Every upload, as it lands.">
        <p>
          This page has no token and no backend. It reads the public{" "}
          <code>production</code> dataset through Sanity&apos;s API CDN and
          subscribes to the Live Content API, so an upload from any browser
          shows up here within seconds. Thumbnails come from cdn.sanity.io.
        </p>
      </PageHeader>
      <LiveFeed />
      <PublicImagesNotice />
    </div>
  );
}
