import type { LiveEvent } from "@sanity/client";

import type { LiveImage } from "./live-query";

export type LiveMode = "live" | "fallback";

export interface LiveImagesSnapshot {
  status: "loading" | "ready" | "error";
  mode: LiveMode;
  images: readonly LiveImage[];
  error: string | null;
  updatedAt: number | null;
}

export interface LiveImagesSource {
  fetchImages(
    lastLiveEventId?: string,
  ): Promise<{ images: LiveImage[]; syncTags: readonly string[] }>;
  subscribeToEvents(observer: {
    next: (event: LiveEvent) => void;
    error: (error: unknown) => void;
  }): () => void;
}

export interface FocusTarget {
  addEventListener(type: "focus", listener: () => void): void;
  removeEventListener(type: "focus", listener: () => void): void;
}

export const INITIAL_LIVE_SNAPSHOT: LiveImagesSnapshot = {
  status: "loading",
  mode: "live",
  images: [],
  error: null,
  updatedAt: null,
};

const FETCH_FAILED_MESSAGE = "Could not load images from Sanity.";

/**
 * External store for useSyncExternalStore. The first subscriber opens the Live Content API stream;
 * the last one closes it. A refetch happens only when Sanity reports a change to a sync tag this
 * query depends on. If the stream is refused (goaway) or fails, the store falls back to refetching
 * on window focus and on demand. It never polls.
 */
export function createLiveImagesStore(dependencies: {
  source: LiveImagesSource;
  focusTarget: FocusTarget;
  now?: () => number;
}) {
  const now = dependencies.now ?? Date.now;
  const listeners = new Set<() => void>();
  let snapshot = INITIAL_LIVE_SNAPSHOT;
  let syncTags: readonly string[] = [];
  let stopEvents: (() => void) | null = null;
  // Only the newest request may publish, so a slow response can't overwrite a newer one.
  let latestRequest = 0;

  function publish(changes: Partial<LiveImagesSnapshot>) {
    snapshot = { ...snapshot, ...changes };
    listeners.forEach((listener) => listener());
  }

  async function refresh(lastLiveEventId?: string) {
    const request = ++latestRequest;
    try {
      const result = await dependencies.source.fetchImages(lastLiveEventId);
      if (request !== latestRequest) return;
      syncTags = result.syncTags;
      publish({
        status: "ready",
        images: result.images,
        error: null,
        updatedAt: now(),
      });
    } catch {
      if (request !== latestRequest) return;
      publish({
        status: snapshot.images.length > 0 ? "ready" : "error",
        error: FETCH_FAILED_MESSAGE,
      });
    }
  }

  function fallBack() {
    stopEvents?.();
    stopEvents = null;
    publish({ mode: "fallback" });
  }

  function handleEvent(event: LiveEvent) {
    switch (event.type) {
      case "message": {
        if (event.tags.some((tag) => syncTags.includes(tag)))
          void refresh(event.id);
        break;
      }
      case "restart": {
        void refresh();
        break;
      }
      case "goaway": {
        fallBack();
        break;
      }
      default: {
        break;
      }
    }
  }

  function refetchWhileFallingBack() {
    if (snapshot.mode === "fallback") void refresh();
  }

  function start() {
    snapshot = { ...snapshot, mode: "live" };
    void refresh();
    stopEvents = dependencies.source.subscribeToEvents({
      next: handleEvent,
      error: fallBack,
    });
    dependencies.focusTarget.addEventListener("focus", refetchWhileFallingBack);
  }

  function stop() {
    stopEvents?.();
    stopEvents = null;
    latestRequest += 1;
    dependencies.focusTarget.removeEventListener(
      "focus",
      refetchWhileFallingBack,
    );
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => INITIAL_LIVE_SNAPSHOT,
    refresh: () => refresh(),
  };
}

export type LiveImagesStore = ReturnType<typeof createLiveImagesStore>;
