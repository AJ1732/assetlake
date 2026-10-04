import { describe, expect, it } from "vitest";

import { publicClientConfig, sanityPublicClient } from "./sanity-public-client";

describe("sanityPublicClient", () => {
  it("is configured without a token", () => {
    expect("token" in publicClientConfig).toBe(false);
    expect(sanityPublicClient.config().token).toBeUndefined();
  });

  it("reads published content through the API CDN", () => {
    expect(sanityPublicClient.config()).toMatchObject({
      useCdn: true,
      perspective: "published",
    });
  });
});
