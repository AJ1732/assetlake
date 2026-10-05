import type { SanityProject } from "@assetlake/sanity-schema/project";
import { describe, expect, it } from "vitest";

import {
  createPublicClientConfig,
  createSanityPublicClient,
} from "./sanity-public-client";

const TARGET = { projectId: "abc123", dataset: "staging" };

describe("createSanityPublicClient", () => {
  it("targets the given project and dataset", () => {
    expect(createSanityPublicClient(TARGET).config()).toMatchObject(TARGET);
  });

  it("is configured without a token, even when the target carries one", () => {
    const smuggled = { ...TARGET, token: "sk-secret" } as SanityProject;

    expect("token" in createPublicClientConfig(smuggled)).toBe(false);
    expect(createSanityPublicClient(smuggled).config().token).toBeUndefined();
  });

  it("reads published content through the API CDN", () => {
    expect(createSanityPublicClient(TARGET).config()).toMatchObject({
      useCdn: true,
      perspective: "published",
    });
  });
});
