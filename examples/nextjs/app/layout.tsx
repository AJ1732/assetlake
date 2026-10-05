import type { ReactNode } from "react";

export const metadata = {
  title: "AssetLake + Next.js",
  description: "Upload images to your own Sanity project with @assetlake/core.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: "2rem" }}>
        {children}
      </body>
    </html>
  );
}
