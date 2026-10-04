import "./globals.css";

import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Instrument_Serif,
} from "next/font/google";
import { preconnect } from "react-dom";

import { cn } from "@/lib/utils";

const bodyFont = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const displayFont = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "AssetLake", template: "%s · AssetLake" },
  description:
    "Upload public images through your backend once, then serve every transformed size straight from cdn.sanity.io.",
};

// Values mirror --background in globals.css (oklch converted to hex for the meta tag).
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1016" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Every AssetLake image on every page comes from this host.
  preconnect("https://cdn.sanity.io");
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        bodyFont.variable,
        displayFont.variable,
        monoFont.variable,
        "font-sans",
      )}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
