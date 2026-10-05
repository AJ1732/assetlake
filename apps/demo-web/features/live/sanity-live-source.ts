import type { SanityClient } from "@sanity/client";

import type { LiveImagesSource } from "./live-images-store";
import { LIVE_IMAGES_QUERY, type LiveImage } from "./live-query";

const REQUEST_TAG = "assetlake.live-feed";

export function createSanityLiveSource(client: SanityClient): LiveImagesSource {
  // The API CDN caches this query for up to 75s (max-age=60, stale-while-revalidate=15). A fetch
  // without a live event id (first load, restart, fallback) may come after the event for a recent
  // upload, so a cached answer would stay stale until the next event. Those fetches read the
  // uncached API; event-driven fetches carry lastLiveEventId, which the CDN honours.
  const uncachedClient = client.withConfig({ useCdn: false });

  return {
    async fetchImages(lastLiveEventId) {
      const reader = lastLiveEventId ? client : uncachedClient;
      const response = await reader.fetch<LiveImage[]>(
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
