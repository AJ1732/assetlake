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
    expect(store.calls.findPresetBySlug).toBe(1);

    store.presets.set("avatar", { ...avatarPreset, quality: 40 });
    clock.advance(1);
    await expect(assetLake.presets.get("avatar")).resolves.toMatchObject({
      quality: 40,
    });
    expect(store.calls.findPresetBySlug).toBe(2);
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
    const { assetLake } = createScenario({}, [
      { ...avatarPreset, ...broken } as typeof avatarPreset,
    ]);
    await expect(assetLake.presets.get("avatar")).rejects.toMatchObject({
      code: "PRESET_INVALID",
    });
  });

  it("lists all presets as named transforms", async () => {
    const { assetLake } = createScenario({}, [
      avatarPreset,
      { ...avatarPreset, slug: "card", name: "Card", width: 640, height: 360 },
    ]);
    const presets = await assetLake.presets.list();
    expect(presets.map((preset) => preset.slug)).toEqual(["avatar", "card"]);
    expect(presets[1].transform).toMatchObject({ width: 640, height: 360 });
  });
});
