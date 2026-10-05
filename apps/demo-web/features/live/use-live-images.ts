import type { SanityProject } from "@assetlake/sanity-schema/project";
import { useMemo, useSyncExternalStore } from "react";

import { createSanityPublicClient } from "@/lib/public/sanity-public-client";

import {
  createLiveImagesStore,
  INITIAL_LIVE_SNAPSHOT,
} from "./live-images-store";
import { memoizeByTarget } from "./memoize-by-target";
import { createSanityLiveSource } from "./sanity-live-source";

const getStore = memoizeByTarget((target) =>
  createLiveImagesStore({
    source: createSanityLiveSource(createSanityPublicClient(target)),
    focusTarget: window,
  }),
);

const getServerSnapshot = () => INITIAL_LIVE_SNAPSHOT;

export function useLiveImages({ projectId, dataset }: SanityProject) {
  // The store is resolved inside the callbacks, not during render: the server render only calls
  // getServerSnapshot, and creating a store there would touch window.
  const store = useMemo(() => {
    const resolve = () => getStore({ projectId, dataset });
    return {
      subscribe: (listener: () => void) => resolve().subscribe(listener),
      getSnapshot: () => resolve().getSnapshot(),
      refresh: () => resolve().refresh(),
    };
  }, [projectId, dataset]);

  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    getServerSnapshot,
  );
  return { ...snapshot, refresh: store.refresh };
}
