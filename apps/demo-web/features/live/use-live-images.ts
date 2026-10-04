import { useSyncExternalStore } from "react";

import { sanityPublicClient } from "@/lib/public/sanity-public-client";

import {
  createLiveImagesStore,
  INITIAL_LIVE_SNAPSHOT,
  type LiveImagesStore,
} from "./live-images-store";
import { createSanityLiveSource } from "./sanity-live-source";

let store: LiveImagesStore | undefined;

function getStore(): LiveImagesStore {
  store ??= createLiveImagesStore({
    source: createSanityLiveSource(sanityPublicClient),
    focusTarget: window,
  });
  return store;
}

const subscribe = (listener: () => void) => getStore().subscribe(listener);
const getSnapshot = () => getStore().getSnapshot();
const getServerSnapshot = () => INITIAL_LIVE_SNAPSHOT;
const refresh = () => getStore().refresh();

export function useLiveImages() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return { ...snapshot, refresh };
}
