import {
  DEFAULT_API_VERSION,
  type SanityProject,
} from "@assetlake/sanity-schema/project";
import { type ClientConfig, createClient } from "@sanity/client";

// Read-only by construction: no token, so it can only see published documents in the public
// dataset. Never add a token here; this module ships to the browser. Fields are copied one by one
// so an object with extra keys can't smuggle a token in.
export function createPublicClientConfig(target: SanityProject) {
  return {
    projectId: target.projectId,
    dataset: target.dataset,
    apiVersion: DEFAULT_API_VERSION,
    useCdn: true,
    perspective: "published",
  } as const satisfies ClientConfig;
}

export const createSanityPublicClient = (target: SanityProject) =>
  createClient(createPublicClientConfig(target));
