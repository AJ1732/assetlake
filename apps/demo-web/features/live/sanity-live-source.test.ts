import type { SanityClient } from "@sanity/client";
import { describe, expect, it } from "vitest";

import { createSanityLiveSource } from "./sanity-live-source";

interface FetchCall {
  useCdn: boolean;
  lastLiveEventId: string | undefined;
}

function createStubClient() {
  const calls: FetchCall[] = [];
  const build = (useCdn: boolean) => ({
    withConfig: (config: { useCdn?: boolean }) =>
      build(config.useCdn ?? useCdn),
    fetch: async (
      _query: string,
      _parameters: unknown,
      options: { lastLiveEventId?: string },
    ) => {
      calls.push({ useCdn, lastLiveEventId: options.lastLiveEventId });
      return { result: [], syncTags: ["s1:feed"] };
    },
    live: {
      events: () => ({ subscribe: () => ({ unsubscribe: () => undefined }) }),
    },
  });
  return { client: build(true) as unknown as SanityClient, calls };
}

describe("createSanityLiveSource", () => {
  it("reads the uncached API when there is no live event id", async () => {
    const { client, calls } = createStubClient();

    await createSanityLiveSource(client).fetchImages();

    expect(calls).toEqual([{ useCdn: false, lastLiveEventId: undefined }]);
  });

  it("reads through the CDN with the event id after a live event", async () => {
    const { client, calls } = createStubClient();

    await createSanityLiveSource(client).fetchImages("event-42");

    expect(calls).toEqual([{ useCdn: true, lastLiveEventId: "event-42" }]);
  });

  it("returns the sync tags the store matches events against", async () => {
    const { client } = createStubClient();

    const result = await createSanityLiveSource(client).fetchImages();

    expect(result.syncTags).toEqual(["s1:feed"]);
  });
});
