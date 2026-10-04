import { type ClientConfig, createClient } from "@sanity/client";

import { publicSanityTarget } from "./public-sanity";

// Read-only by construction: no token, so it can only see published documents in the public
// dataset. Never add a token here; this module ships to the browser.
export const publicClientConfig = {
  ...publicSanityTarget,
  useCdn: true,
  perspective: "published",
} as const satisfies ClientConfig;

export const sanityPublicClient = createClient(publicClientConfig);
