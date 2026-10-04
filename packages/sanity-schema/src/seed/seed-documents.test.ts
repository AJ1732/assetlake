import { describe, expect, it } from "vitest";

import {
  DOCUMENT_TYPES,
  IMAGE_FIT_MODES,
  PRESET_QUALITY_RANGE,
  TRANSFORMABLE_IMAGE_MIME_TYPES,
} from "../constants";
import { SEED_IDS, type SeedDocument, seedDocuments } from "./seed-documents";

const documents = seedDocuments();
const ofType = (type: string) =>
  documents.filter((document) => document._type === type);

function collectReferences(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectReferences);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const own = typeof record._ref === "string" ? [record._ref] : [];
    return [...own, ...Object.values(record).flatMap(collectReferences)];
  }
  return [];
}

describe("seedDocuments", () => {
  it("produces one application, one policy and the four demo presets", () => {
    expect(documents).toHaveLength(6);
    expect(ofType(DOCUMENT_TYPES.application)).toHaveLength(1);
    expect(ofType(DOCUMENT_TYPES.policy)).toHaveLength(1);
    expect(
      ofType(DOCUMENT_TYPES.preset).map(
        (preset) => (preset.slug as { current: string }).current,
      ),
    ).toEqual(["avatar-sm", "avatar", "card", "hero"]);
  });

  it("uses publicly readable ids (no '.' path segments)", () => {
    for (const document of documents) {
      expect(document._id).toMatch(/^assetlake-[a-z0-9-]+$/);
    }
  });

  it("only references documents inside the seed", () => {
    const ids = new Set(documents.map((document) => document._id));
    for (const ref of collectReferences(documents)) {
      expect(ids.has(ref), ref).toBe(true);
    }
  });

  it("gives every array reference a stable unique _key", () => {
    const application = documents.find(
      (document) => document._id === SEED_IDS.application,
    ) as SeedDocument & {
      presets: Array<{ _key: string }>;
    };
    const keys = application.presets.map((item) => item._key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps preset values inside what the image pipeline accepts", () => {
    for (const preset of ofType(DOCUMENT_TYPES.preset)) {
      expect(IMAGE_FIT_MODES).toContain(preset.fit);
      expect(Number.isInteger(preset.width)).toBe(true);
      expect(Number.isInteger(preset.height)).toBe(true);
      expect(Number.isInteger(preset.quality)).toBe(true);
      expect(preset.quality as number).toBeGreaterThanOrEqual(
        PRESET_QUALITY_RANGE.min,
      );
      expect(preset.quality as number).toBeLessThanOrEqual(
        PRESET_QUALITY_RANGE.max,
      );
    }
  });

  it("restricts the demo policy to transformable JPEG, PNG and WebP up to 5 MB", () => {
    const [policy] = ofType(DOCUMENT_TYPES.policy);
    expect(policy.allowedMimeTypes).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    for (const mime of policy.allowedMimeTypes as string[]) {
      expect(TRANSFORMABLE_IMAGE_MIME_TYPES).toContain(mime);
    }
    expect(policy.maxFileSizeBytes).toBe(5_242_880);
    expect(policy.requiresReview).toBe(false);
  });

  it("is deterministic across calls", () => {
    expect(seedDocuments()).toEqual(documents);
  });
});
