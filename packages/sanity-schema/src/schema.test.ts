import {
  APPLICATION_ENVIRONMENTS,
  DOCUMENT_TYPES,
  IMAGE_CROP_MODES,
  IMAGE_FIT_MODES,
  IMAGE_PURPOSES,
  IMAGE_STATUSES,
  TRANSFORMABLE_IMAGE_MIME_TYPES,
} from "@assetlake/core/contracts";
import { describe, expect, it } from "vitest";

import { schemaTypes } from "./index";

type FieldShape = {
  name: string;
  type: string;
  validation?: unknown;
  to?: Array<{ type: string }>;
  of?: Array<{ type: string; to?: Array<{ type: string }> }>;
  options?: { list?: readonly unknown[] };
};

const typeByName = new Map<string, (typeof schemaTypes)[number]>(
  schemaTypes.map((type) => [type.name, type]),
);

function fieldsOf(typeName: string): FieldShape[] {
  const type = typeByName.get(typeName) as unknown as
    | { fields: FieldShape[] }
    | undefined;
  if (!type) throw new Error(`Schema type ${typeName} not registered`);
  return type.fields;
}

function field(typeName: string, fieldName: string): FieldShape {
  const found = fieldsOf(typeName).find(
    (candidate) => candidate.name === fieldName,
  );
  if (!found) throw new Error(`${typeName}.${fieldName} missing`);
  return found;
}

describe("AssetLake schema", () => {
  it("registers exactly the four AssetLake document types", () => {
    expect(schemaTypes.map((type) => type.name).sort()).toEqual(
      Object.values(DOCUMENT_TYPES).sort(),
    );
    expect(schemaTypes.every((type) => type.type === "document")).toBe(true);
  });

  it.each([
    [DOCUMENT_TYPES.application, ["name", "slug", "environment"]],
    [
      DOCUMENT_TYPES.policy,
      ["name", "slug", "allowedMimeTypes", "maxFileSizeBytes"],
    ],
    [DOCUMENT_TYPES.preset, ["name", "slug"]],
    [
      DOCUMENT_TYPES.image,
      ["image", "application", "purpose", "status", "uploadedAt"],
    ],
  ])(
    "%s attaches validation to its required fields",
    (typeName, requiredFields) => {
      for (const fieldName of requiredFields) {
        expect(
          field(typeName, fieldName).validation,
          `${typeName}.${fieldName}`,
        ).toBeTypeOf("function");
      }
    },
  );

  it.each([
    [DOCUMENT_TYPES.preset, "fit", IMAGE_FIT_MODES],
    [DOCUMENT_TYPES.preset, "crop", IMAGE_CROP_MODES],
    [DOCUMENT_TYPES.policy, "allowedMimeTypes", TRANSFORMABLE_IMAGE_MIME_TYPES],
    [DOCUMENT_TYPES.image, "purpose", IMAGE_PURPOSES],
    [DOCUMENT_TYPES.image, "status", IMAGE_STATUSES],
    [DOCUMENT_TYPES.application, "environment", APPLICATION_ENVIRONMENTS],
  ])(
    "%s.%s options come from the shared constants",
    (typeName, fieldName, expected) => {
      expect(field(typeName, fieldName).options?.list).toEqual([...expected]);
    },
  );

  it("only references AssetLake document types that exist", () => {
    const known = new Set<string>(Object.values(DOCUMENT_TYPES));
    for (const type of schemaTypes) {
      for (const candidate of fieldsOf(type.name)) {
        const targets = [
          ...(candidate.to ?? []),
          ...(candidate.of ?? []).flatMap((member) => member.to ?? []),
        ];
        for (const target of targets) {
          expect(
            known.has(target.type),
            `${type.name}.${candidate.name} -> ${target.type}`,
          ).toBe(true);
        }
      }
    }
  });

  it("does not duplicate asset-owned metadata on assetLakeImage", () => {
    const names = fieldsOf(DOCUMENT_TYPES.image).map(
      (candidate) => candidate.name,
    );
    for (const duplicated of ["url", "width", "height", "mimeType", "size"]) {
      expect(names).not.toContain(duplicated);
    }
  });

  it("has no secret-shaped field on any public document type", () => {
    for (const type of schemaTypes) {
      for (const candidate of fieldsOf(type.name)) {
        expect(candidate.name, `${type.name}.${candidate.name}`).not.toMatch(
          /token|secret|password|apikey/i,
        );
      }
    }
  });
});
