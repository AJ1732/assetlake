import type { LiveEvent } from "@sanity/client";
import { describe, expect, it, vi } from "vitest";

import {
  createLiveImagesStore,
  type FocusTarget,
  type LiveImagesSource,
} from "./live-images-store";
import type { LiveImage } from "./live-query";

function liveImage(id: string): LiveImage {
  return {
    id,
    purpose: "avatar",
    status: "ready",
    uploadedAt: "2026-10-04T12:00:00.000Z",
    alt: null,
    image: { asset: { _ref: "image-abc123-256x256-png" } },
    width: 256,
    height: 256,
    lqip: null,
  };
}

function createFakeSource(
  responses: Array<{ images: LiveImage[]; syncTags: string[] } | Error>,
) {
  const fetchCalls: Array<string | undefined> = [];
  let observer:
    | { next: (event: LiveEvent) => void; error: (error: unknown) => void }
    | undefined;
  const unsubscribe = vi.fn();

  const source: LiveImagesSource = {
    async fetchImages(lastLiveEventId) {
      fetchCalls.push(lastLiveEventId);
      const response = responses.shift() ?? { images: [], syncTags: [] };
      if (response instanceof Error) throw response;
      return response;
    },
    subscribeToEvents(nextObserver) {
      observer = nextObserver;
      return unsubscribe;
    },
  };

  return {
    source,
    fetchCalls,
    unsubscribe,
    emit: (event: LiveEvent) => observer?.next(event),
    fail: (error: unknown) => observer?.error(error),
  };
}

function createFakeFocusTarget() {
  const listeners = new Set<() => void>();
  const target: FocusTarget = {
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
  return {
    target,
    focus: () => listeners.forEach((listener) => listener()),
    listeners,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(responses: Parameters<typeof createFakeSource>[0]) {
  const fake = createFakeSource(responses);
  const focus = createFakeFocusTarget();
  const store = createLiveImagesStore({
    source: fake.source,
    focusTarget: focus.target,
    now: () => 1000,
  });
  return { fake, focus, store };
}

describe("createLiveImagesStore", () => {
  it("starts loading, then publishes the first fetch", async () => {
    const { store } = setup([
      { images: [liveImage("a")], syncTags: ["s1:feed"] },
    ]);
    expect(store.getSnapshot().status).toBe("loading");

    const listener = vi.fn();
    store.subscribe(listener);
    await flush();

    expect(store.getSnapshot()).toMatchObject({
      status: "ready",
      mode: "live",
      images: [liveImage("a")],
      updatedAt: 1000,
    });
    expect(listener).toHaveBeenCalled();
  });

  it("refetches with the event id when a message carries a known sync tag", async () => {
    const { fake, store } = setup([
      { images: [liveImage("a")], syncTags: ["s1:feed"] },
      { images: [liveImage("b"), liveImage("a")], syncTags: ["s1:feed"] },
    ]);
    store.subscribe(() => {});
    await flush();

    fake.emit({
      type: "message",
      id: "event-7",
      tags: ["s1:unrelated", "s1:feed"],
    });
    await flush();

    expect(fake.fetchCalls).toEqual([undefined, "event-7"]);
    expect(store.getSnapshot().images.map((image) => image.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("ignores messages whose tags this query does not depend on", async () => {
    const { fake, store } = setup([{ images: [], syncTags: ["s1:feed"] }]);
    store.subscribe(() => {});
    await flush();

    fake.emit({ type: "message", id: "event-8", tags: ["s1:other"] });
    fake.emit({ type: "welcome" });
    fake.emit({ type: "reconnect" });
    await flush();

    expect(fake.fetchCalls).toEqual([undefined]);
  });

  it("refetches without an event id on restart", async () => {
    const { fake, store } = setup([]);
    store.subscribe(() => {});
    await flush();

    fake.emit({ type: "restart", id: "event-9" });
    await flush();

    expect(fake.fetchCalls).toEqual([undefined, undefined]);
  });

  it("falls back to focus refetching on goaway and closes the stream", async () => {
    const { fake, focus, store } = setup([]);
    store.subscribe(() => {});
    await flush();
    focus.focus();
    expect(fake.fetchCalls).toHaveLength(1);

    fake.emit({ type: "goaway", id: "event-10", reason: "connection limit" });
    expect(store.getSnapshot().mode).toBe("fallback");
    expect(fake.unsubscribe).toHaveBeenCalledOnce();

    focus.focus();
    await flush();
    expect(fake.fetchCalls).toHaveLength(2);
  });

  it("falls back when the event stream errors", async () => {
    const { fake, store } = setup([]);
    store.subscribe(() => {});
    fake.fail(new Error("CORS"));
    expect(store.getSnapshot().mode).toBe("fallback");
  });

  it("reports an error when the first fetch fails and keeps images on later failures", async () => {
    const first = setup([new Error("down")]);
    first.store.subscribe(() => {});
    await flush();
    expect(first.store.getSnapshot()).toMatchObject({
      status: "error",
      images: [],
    });

    const later = setup([
      { images: [liveImage("a")], syncTags: [] },
      new Error("down"),
    ]);
    later.store.subscribe(() => {});
    await flush();
    await later.store.refresh();
    expect(later.store.getSnapshot()).toMatchObject({
      status: "ready",
      images: [liveImage("a")],
      error: "Could not load images from Sanity.",
    });
  });

  it("tears everything down after the last subscriber leaves", async () => {
    const { fake, focus, store } = setup([]);
    const leaveFirst = store.subscribe(() => {});
    const leaveSecond = store.subscribe(() => {});
    await flush();

    leaveFirst();
    expect(fake.unsubscribe).not.toHaveBeenCalled();
    leaveSecond();
    expect(fake.unsubscribe).toHaveBeenCalledOnce();
    expect(focus.listeners.size).toBe(0);
  });

  it("drops a response that arrives after a newer request started", async () => {
    let resolveSlow: (value: {
      images: LiveImage[];
      syncTags: string[];
    }) => void = () => {};
    const source: LiveImagesSource = {
      fetchImages: vi
        .fn<LiveImagesSource["fetchImages"]>()
        .mockImplementationOnce(
          () => new Promise((resolve) => (resolveSlow = resolve)),
        )
        .mockResolvedValueOnce({ images: [liveImage("new")], syncTags: [] }),
      subscribeToEvents: () => () => {},
    };
    const store = createLiveImagesStore({
      source,
      focusTarget: createFakeFocusTarget().target,
    });
    store.subscribe(() => {});
    await store.refresh();
    resolveSlow({ images: [liveImage("stale")], syncTags: [] });
    await flush();

    expect(store.getSnapshot().images.map((image) => image.id)).toEqual([
      "new",
    ]);
  });
});
