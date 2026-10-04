import { describe, expect, it } from "vitest";

import { summarizeImageHosts } from "./summarize-image-hosts";

const ORIGIN = "http://localhost:3000";
const cdn = (path: string) => ({
  name: `https://cdn.sanity.io/images/oshzwvjy/production/${path}`,
  initiatorType: "img",
});

describe("summarizeImageHosts", () => {
  it("counts image requests per host, busiest first", () => {
    const summary = summarizeImageHosts(
      [
        cdn("a-256x256.png?w=96"),
        cdn("a-256x256.png?w=256"),
        { name: `${ORIGIN}/next.svg`, initiatorType: "img" },
      ],
      ORIGIN,
    );
    expect(summary.hosts).toEqual([
      { host: "cdn.sanity.io", count: 2, isAppOrigin: false },
      { host: "localhost:3000", count: 1, isAppOrigin: true },
    ]);
    expect(summary.appOriginCount).toBe(1);
  });

  it("flags requests that went through the Next image optimizer", () => {
    const summary = summarizeImageHosts(
      [
        {
          name: `${ORIGIN}/_next/image?url=x&w=256&q=75`,
          initiatorType: "img",
        },
      ],
      ORIGIN,
    );
    expect(summary.optimizerCount).toBe(1);
    expect(summary.appOriginCount).toBe(1);
  });

  it("ignores non-image resources, blob previews, data placeholders, and garbage", () => {
    const summary = summarizeImageHosts(
      [
        { name: `${ORIGIN}/_next/static/chunk.js`, initiatorType: "script" },
        { name: "blob:http://localhost:3000/123", initiatorType: "img" },
        { name: "data:image/jpeg;base64,AAAA", initiatorType: "img" },
        { name: "not a url", initiatorType: "img" },
      ],
      ORIGIN,
    );
    expect(summary).toEqual({
      hosts: [],
      appOriginCount: 0,
      optimizerCount: 0,
    });
  });
});
