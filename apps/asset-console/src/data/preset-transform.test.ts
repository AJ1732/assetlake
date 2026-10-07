import { createAssetLake } from "@assetlake/core";
import {
  InMemoryStore,
  type PresetRecord,
  silentLogger,
} from "@assetlake/core/testing";
import { describe, expect, it } from "vitest";

import {
  describeTransform,
  FALLBACK_THUMBNAIL,
  parsePresetInput,
  thumbnailTransform,
  toPresetTransform,
  toPresetVariant,
  withPresetField,
} from "./preset-transform";
import { presetRow } from "./test-fixtures";

const SEEDED_PRESETS: PresetRecord[] = [
  {
    slug: "avatar-sm",
    name: "Avatar small",
    width: 96,
    height: 96,
    fit: "crop",
    crop: null,
    quality: 80,
    autoFormat: true,
  },
  {
    slug: "avatar",
    name: "Avatar",
    width: 256,
    height: 256,
    fit: "crop",
    crop: null,
    quality: 82,
    autoFormat: true,
  },
  {
    slug: "card",
    name: "Card",
    width: 640,
    height: 360,
    fit: "crop",
    crop: null,
    quality: 80,
    autoFormat: true,
  },
  {
    slug: "hero",
    name: "Hero",
    width: 1600,
    height: 900,
    fit: "max",
    crop: null,
    quality: 82,
    autoFormat: true,
  },
  {
    slug: "partial",
    name: "Partial",
    width: 300,
    height: null,
    fit: null,
    crop: "entropy",
    quality: null,
    autoFormat: false,
  },
];

const INVALID_PRESETS: PresetRecord[] = [
  { ...SEEDED_PRESETS[1]!, slug: "fractional", width: 255.5 },
  { ...SEEDED_PRESETS[1]!, slug: "zero-quality", quality: 0 },
  { ...SEEDED_PRESETS[1]!, slug: "high-quality", quality: 101 },
  { ...SEEDED_PRESETS[1]!, slug: "bad-fit", fit: "stretch" },
  { ...SEEDED_PRESETS[1]!, slug: "bad-crop", crop: "middle" },
  { ...SEEDED_PRESETS[1]!, slug: "negative-height", height: -1 },
];

function coreResolver(presets: PresetRecord[]) {
  const assetLake = createAssetLake(
    {
      projectId: "testproject",
      dataset: "test",
      apiVersion: "2026-10-04",
      token: "not-a-real-token",
    },
    { store: new InMemoryStore({ presets }), logger: silentLogger },
  );
  return assetLake.presets;
}

describe("toPresetTransform matches core's resolver", () => {
  it.each(SEEDED_PRESETS)(
    "maps valid preset $slug like core",
    async (preset) => {
      const expected = await coreResolver(SEEDED_PRESETS).get(preset.slug);
      expect(toPresetTransform(preset)).toEqual({
        transform: expected,
        issues: [],
      });
    },
  );

  it.each(INVALID_PRESETS)(
    "flags preset $slug that core rejects",
    async (preset) => {
      await expect(
        coreResolver([preset]).get(preset.slug),
      ).rejects.toMatchObject({
        code: "PRESET_INVALID",
      });
      expect(toPresetTransform(preset).issues).not.toEqual([]);
    },
  );
});

describe("toPresetTransform", () => {
  it("treats null and undefined as unset", () => {
    expect(
      toPresetTransform({ width: null, height: undefined, quality: 60 }),
    ).toEqual({ transform: { quality: 60 }, issues: [] });
  });

  it("names the field and keeps the valid fields of a broken draft", () => {
    const result = toPresetTransform({
      width: 255.5,
      height: 256,
      quality: 82,
    });
    expect(result.transform).toEqual({ height: 256, quality: 82 });
    expect(result.issues).toEqual([
      { field: "width", message: "width must be a whole number above 0" },
    ]);
  });

  it("explains the quality range", () => {
    expect(toPresetTransform({ quality: 101 }).issues[0]?.message).toBe(
      "quality must be a whole number from 1 to 100",
    );
  });
});

describe("toPresetVariant", () => {
  it("falls back to the id when slug and name are missing", () => {
    const variant = toPresetVariant(presetRow({ slug: null, name: null }));
    expect(variant.slug).toBe("assetlake-preset-avatar");
    expect(variant.name).toBe("assetlake-preset-avatar");
  });
});

describe("thumbnailTransform", () => {
  const avatarSm = toPresetVariant(
    presetRow({
      id: "assetlake-preset-avatar-sm",
      slug: "avatar-sm",
      width: 96,
      height: 96,
    }),
  );

  it("uses the avatar-sm preset when it is valid", () => {
    expect(thumbnailTransform([avatarSm])).toEqual({
      transform: avatarSm.transform,
      fromPreset: true,
    });
  });

  it("falls back when avatar-sm is missing", () => {
    expect(thumbnailTransform([])).toEqual({
      transform: FALLBACK_THUMBNAIL,
      fromPreset: false,
    });
  });

  it("falls back when avatar-sm is invalid", () => {
    const broken = {
      ...avatarSm,
      issues: [{ field: "width" as const, message: "x" }],
    };
    expect(thumbnailTransform([broken]).fromPreset).toBe(false);
  });
});

describe("describeTransform", () => {
  it("summarizes every set field", () => {
    expect(
      describeTransform({
        width: 256,
        height: 256,
        fit: "crop",
        quality: 82,
        autoFormat: true,
      }),
    ).toBe("256 × 256 · crop · q82 · auto format");
  });

  it("handles a width-only transform with a crop mode", () => {
    expect(describeTransform({ width: 300, crop: "entropy" })).toBe(
      "300 wide · crop entropy",
    );
  });

  it("returns an empty string for an empty transform", () => {
    expect(describeTransform({})).toBe("");
  });
});

describe("parsePresetInput", () => {
  it.each([
    ["", undefined],
    ["  ", undefined],
    ["82", 82],
    ["255.5", 255.5],
    ["abc", undefined],
  ])("parses %j as %s", (raw, expected) => {
    expect(parsePresetInput(raw)).toBe(expected);
  });
});

describe("withPresetField", () => {
  const preset = { _id: "assetlake-preset-avatar", quality: 82, width: 256 };

  it("sets a field without touching the rest", () => {
    expect(withPresetField(preset, "quality", 60)).toEqual({
      ...preset,
      quality: 60,
    });
  });

  it("removes a field when the value is undefined", () => {
    expect(withPresetField(preset, "quality", undefined)).toEqual({
      _id: "assetlake-preset-avatar",
      width: 256,
    });
  });

  it("does not mutate the input", () => {
    withPresetField(preset, "quality", 1);
    expect(preset.quality).toBe(82);
  });
});
