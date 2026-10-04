import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages export TypeScript source, so Next must compile them.
  transpilePackages: ["@assetlake/core", "@assetlake/sanity-schema"],
};

export default nextConfig;
