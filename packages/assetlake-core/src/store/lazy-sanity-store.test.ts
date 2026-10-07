import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseAssetLakeConfig } from "../client/config";
import { createLazySanityStore } from "./lazy-sanity-store";

const sanity = vi.hoisted(() => ({
  createClient: vi.fn(),
  fetch: vi.fn(async () => null),
}));

vi.mock("@sanity/client", () => ({ createClient: sanity.createClient }));

const config = parseAssetLakeConfig({
  projectId: "testproject",
  dataset: "test",
  apiVersion: "2026-10-04",
  token: "sk-test",
});

beforeEach(() => {
  sanity.createClient.mockReset();
  sanity.createClient.mockReturnValue({ fetch: sanity.fetch });
});

describe("lazy Sanity store", () => {
  it("creates no client until the first store call", () => {
    createLazySanityStore(config);

    expect(sanity.createClient).not.toHaveBeenCalled();
  });

  it("creates the client once and reuses it for every later call", async () => {
    const store = createLazySanityStore(config);

    await Promise.all([
      store.findPresetBySlug("avatar"),
      store.findImageSource("assetlake-image-1"),
    ]);
    await store.listPresets();

    expect(sanity.createClient).toHaveBeenCalledTimes(1);
    expect(sanity.createClient).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "testproject", useCdn: false }),
    );
    expect(sanity.fetch).toHaveBeenCalledWith(expect.any(String), {
      slug: "avatar",
    });
  });

  it("tries to load the client again after a failed load", async () => {
    const store = createLazySanityStore(config);
    sanity.createClient.mockImplementationOnce(() => {
      throw new Error("client failed to load");
    });

    await expect(store.listPresets()).rejects.toThrow("client failed to load");
    await expect(store.listPresets()).resolves.toBeNull();
    expect(sanity.createClient).toHaveBeenCalledTimes(2);
  });
});
