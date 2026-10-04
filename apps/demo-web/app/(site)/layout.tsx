import "./site.css";

import Link from "next/link";

import { SiteNav } from "@/components/site-nav";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand">
            <span aria-hidden="true" className="brand-mark" />
            AssetLake
          </Link>
          <SiteNav />
        </div>
      </header>
      <main id="main" className="site-main">
        {children}
      </main>
      <footer className="site-footer">
        <p>
          Public images only. Uploads go through this app&apos;s backend; images
          are delivered by <span className="font-mono">cdn.sanity.io</span>.
        </p>
        <p className="text-muted-foreground">
          Built for the Sanity Challenge 2026.
        </p>
      </footer>
    </>
  );
}
