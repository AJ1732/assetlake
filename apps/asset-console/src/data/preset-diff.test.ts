import { describe, expect, it } from "vitest";

import { describeChange, draftRow, presetChanges } from "./preset-diff";
import { presetRow } from "./test-fixtures";

describe("presetChanges", () => {
  const published = presetRow();

  it("reports nothing when the draft matches the published preset", () => {
    expect(presetChanges(presetRow(), published)).toEqual([]);
  });

  it("reports only the changed field", () => {
    expect(presetChanges(presetRow({ quality: 60 }), published)).toEqual([
      { field: "quality", published: 82, draft: 60 },
    ]);
  });

  it("reports a field unset in the draft", () => {
    const { width: _width, ...withoutWidth } = presetRow();
    expect(presetChanges(withoutWidth, published)).toEqual([
      { field: "width", published: 256, draft: null },
    ]);
  });

  it("treats null and undefined as the same unset value", () => {
    expect(
      presetChanges(presetRow({ crop: undefined }), presetRow({ crop: null })),
    ).toEqual([]);
  });

  it("diffs a never-published preset against nothing", () => {
    const changes = presetChanges(presetRow({ crop: null }), undefined);
    expect(changes.map((change) => change.field)).toEqual([
      "width",
      "height",
      "fit",
      "quality",
      "autoFormat",
    ]);
  });
});

describe("draftRow", () => {
  const published = presetRow();
  const draftDocument = {
    _id: "drafts.assetlake-preset-avatar",
    _type: "assetLakePreset",
    name: "Avatar",
    slug: { _type: "slug", current: "avatar" },
    width: 256,
    height: 256,
    fit: "crop",
    quality: 60,
    autoFormat: true,
  };

  it("takes transform fields from the draft and keeps the string slug and published id", () => {
    expect(draftRow(published, draftDocument)).toEqual({
      ...published,
      quality: 60,
      crop: null,
    });
  });

  it("keeps a field unset in the draft unset", () => {
    const { width: _width, ...withoutWidth } = draftDocument;
    expect(draftRow(published, withoutWidth).width).toBeNull();
  });

  it("falls back to the published name", () => {
    expect(draftRow(published, { ...draftDocument, name: null }).name).toBe(
      "Avatar",
    );
  });
});

describe("describeChange", () => {
  it("reads as before and after", () => {
    expect(describeChange({ field: "quality", published: 82, draft: 60 })).toBe(
      "quality 82 → 60",
    );
  });

  it("names unset values and booleans", () => {
    expect(
      describeChange({ field: "autoFormat", published: true, draft: null }),
    ).toBe("autoFormat on → unset");
  });
});
