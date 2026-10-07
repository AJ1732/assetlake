import { describe, expect, it } from "vitest";

import { avatarPreset, createScenario } from "../testing/scenario";

describe("presets", () => {
  it("maps a preset document to a transform, dropping unset fields", async () => {
    const { assetLake } = createScenario();
    await expect(assetLake.presets.get("avatar")).resolves.toEqual({
      width: 256,
      height: 256,
      fit: "crop",
      quality: 82,
      autoFormat: true,
    });
  });

  it("serves repeat lookups from cache within the TTL and refetches after it", async () => {
    const { assetLake, store, clock } = createScenario();
    await assetLake.presets.get("avatar");
    clock.advance(59_999);
    await assetLake.presets.get("avatar");
    expect(store.callCount("findPresetBySlug")).toBe(1);

    store.presets.set("avatar", { ...avatarPreset, quality: 40 });
    clock.advance(1);
    await expect(assetLake.presets.get("avatar")).resolves.toMatchObject({
      quality: 40,
    });
    expect(store.callCount("findPresetBySlug")).toBe(2);
  });

  it("throws PRESET_NOT_FOUND and logs it for an unknown slug", async () => {
    const { assetLake, events } = createScenario();
    await expect(assetLake.presets.get("billboard")).rejects.toMatchObject({
      code: "PRESET_NOT_FOUND",
    });
    expect(events()).toContain("PRESET_NOT_FOUND");
  });

  it.each([
    [{ fit: "stretch" }],
    [{ width: 120.5 }],
    [{ quality: 0 }],
    [{ crop: "middle" }],
  ])("rejects an edited preset with invalid values %o", async (broken) => {
    const { assetLake } = createScenario({
      presets: [{ ...avatarPreset, ...broken } as typeof avatarPreset],
    });
    await expect(assetLake.presets.get("avatar")).rejects.toMatchObject({
      code: "PRESET_INVALID",
    });
  });

  it("lists all presets as named transforms", async () => {
    const { assetLake } = createScenario({
      presets: [
        avatarPreset,
        {
          ...avatarPreset,
          slug: "card",
          name: "Card",
          width: 640,
          height: 360,
        },
      ],
    });
    const presets = await assetLake.presets.list();
    expect(presets.map((preset) => preset.slug)).toEqual(["avatar", "card"]);
    expect(presets[1].transform).toMatchObject({ width: 640, height: 360 });
  });

  it("shares one read between concurrent cold lookups of a slug", async () => {
    const { assetLake, store } = createScenario();

    await Promise.all([
      assetLake.presets.get("avatar"),
      assetLake.presets.get("avatar"),
      assetLake.presets.get("avatar"),
    ]);

    expect(store.callCount("findPresetBySlug")).toBe(1);
  });

  it("remembers an unknown slug for 5 seconds, so a new preset still appears quickly", async () => {
    const { assetLake, store, clock } = createScenario();
    const lookUpBillboard = () =>
      assetLake.presets.get("billboard").catch((error: unknown) => error);

    await lookUpBillboard();
    clock.advance(4_999);
    await expect(lookUpBillboard()).resolves.toMatchObject({
      code: "PRESET_NOT_FOUND",
    });
    expect(store.callCount("findPresetBySlug")).toBe(1);

    store.presets.set("billboard", { ...avatarPreset, slug: "billboard" });
    clock.advance(1);
    await expect(assetLake.presets.get("billboard")).resolves.toMatchObject({
      width: 256,
    });
    expect(store.callCount("findPresetBySlug")).toBe(2);
  });

  it("caches nothing when presetCacheTtlMs is 0", async () => {
    const { assetLake, store } = createScenario({
      config: { presetCacheTtlMs: 0 },
    });

    await assetLake.presets.get("avatar");
    await assetLake.presets.get("avatar");
    await assetLake.presets.get("billboard").catch(() => undefined);
    await assetLake.presets.get("billboard").catch(() => undefined);

    expect(store.callCount("findPresetBySlug")).toBe(4);
  });

  it("warms single lookups from a list", async () => {
    const { assetLake, store } = createScenario();

    await assetLake.presets.list();
    await assetLake.presets.get("avatar");

    expect(store.callCount("findPresetBySlug")).toBe(0);
  });

  it("retries a lookup whose read failed instead of caching the failure", async () => {
    const { assetLake, store } = createScenario();
    store.failNext("findPresetBySlug");

    await expect(assetLake.presets.get("avatar")).rejects.toThrow(
      "findPresetBySlug failed",
    );
    await expect(assetLake.presets.get("avatar")).resolves.toMatchObject({
      width: 256,
    });
    expect(store.callCount("findPresetBySlug")).toBe(2);
  });
});
