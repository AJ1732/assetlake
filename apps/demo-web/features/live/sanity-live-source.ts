import type { SanityClient } from "@sanity/client";

import type { LiveImagesSource } from "./live-images-store";
import { LIVE_IMAGES_QUERY, type LiveImage } from "./live-query";

const REQUEST_TAG = "assetlake.live-feed";

export function createSanityLiveSource(client: SanityClient): LiveImagesSource {
  return {
    async fetchImages(lastLiveEventId) {
      const response = await client.fetch<LiveImage[]>(
        LIVE_IMAGES_QUERY,
        {},
        { filterResponse: false, lastLiveEventId, tag: REQUEST_TAG },
      );
      return { images: response.result, syncTags: response.syncTags ?? [] };
    },
    subscribeToEvents(observer) {
      const subscription = client.live
        .events({ tag: REQUEST_TAG })
        .subscribe(observer);
      return () => subscription.unsubscribe();
    },
  };
}
