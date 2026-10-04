import { createPngBytes } from "@assetlake/core/testing";

// Generated per run so nothing binary is committed. A random seed gives fresh bytes, so Sanity
// does not dedupe the upload into an asset an earlier run already created.
export function generatePng(size = 512) {
  const seed = Math.floor(Math.random() * 1_000_000);
  return {
    name: `e2e-${seed}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(createPngBytes(size, size, seed)),
  };
}
