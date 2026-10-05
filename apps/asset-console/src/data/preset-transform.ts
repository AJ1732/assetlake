import {
  IMAGE_CROP_MODES,
  IMAGE_FIT_MODES,
  type ImageCropMode,
  type ImageFitMode,
  PRESET_QUALITY_RANGE,
} from "@assetlake/core/contracts";
import type { ImageTransform } from "@assetlake/core/url";

import type { PresetFields, PresetRow } from "./types";

// Browser-side twin of core's toTransform (presets/preset-resolver.ts), which uses zod and cannot
// ship through @assetlake/core/url. Same rules, but it reports issues instead of throwing so a
// half-edited draft renders a warning, not a broken URL. presetTransform.test.ts keeps the twins equal.

export type PresetFieldName = keyof PresetFields;
export type NumericPresetField = "width" | "height" | "quality";

export interface TransformIssue {
  field: PresetFieldName;
  message: string;
}

export interface PresetTransformResult {
  transform: ImageTransform;
  issues: TransformIssue[];
}

export interface PresetVariant extends PresetTransformResult {
  id: string;
  slug: string;
  name: string;
}

export const THUMBNAIL_PRESET_SLUG = "avatar-sm";
export const FALLBACK_THUMBNAIL: ImageTransform = {
  width: 96,
  height: 96,
  fit: "crop",
  autoFormat: true,
};

const isPositiveInteger = (value: number) =>
  Number.isInteger(value) && value > 0;
const isQuality = (value: number) =>
  Number.isInteger(value) &&
  value >= PRESET_QUALITY_RANGE.min &&
  value <= PRESET_QUALITY_RANGE.max;
const isOneOf = <T extends string>(
  list: readonly T[],
  value: string,
): value is T => (list as readonly string[]).includes(value);

const NUMBER_RULES: Record<
  NumericPresetField,
  { isValid: (value: number) => boolean; message: string }
> = {
  width: {
    isValid: isPositiveInteger,
    message: "must be a whole number above 0",
  },
  height: {
    isValid: isPositiveInteger,
    message: "must be a whole number above 0",
  },
  quality: {
    isValid: isQuality,
    message: `must be a whole number from ${PRESET_QUALITY_RANGE.min} to ${PRESET_QUALITY_RANGE.max}`,
  },
};

const isUnset = (value: unknown): value is null | undefined =>
  value === null || value === undefined;

export function toPresetTransform(fields: PresetFields): PresetTransformResult {
  const transform: ImageTransform = {};
  const issues: TransformIssue[] = [];

  for (const field of Object.keys(NUMBER_RULES) as NumericPresetField[]) {
    const value = fields[field];
    if (isUnset(value)) continue;
    if (NUMBER_RULES[field].isValid(value)) transform[field] = value;
    else
      issues.push({
        field,
        message: `${field} ${NUMBER_RULES[field].message}`,
      });
  }

  if (!isUnset(fields.fit)) {
    if (isOneOf<ImageFitMode>(IMAGE_FIT_MODES, fields.fit))
      transform.fit = fields.fit;
    else
      issues.push({
        field: "fit",
        message: `fit "${fields.fit}" is not supported`,
      });
  }

  if (!isUnset(fields.crop)) {
    if (isOneOf<ImageCropMode>(IMAGE_CROP_MODES, fields.crop))
      transform.crop = fields.crop;
    else
      issues.push({
        field: "crop",
        message: `crop "${fields.crop}" is not supported`,
      });
  }

  if (!isUnset(fields.autoFormat)) transform.autoFormat = fields.autoFormat;

  return { transform, issues };
}

export function toPresetVariant(row: PresetRow): PresetVariant {
  const slug = row.slug ?? row.id;
  return {
    id: row.id,
    slug,
    name: row.name ?? slug,
    ...toPresetTransform(row),
  };
}

export function thumbnailTransform(variants: readonly PresetVariant[]): {
  transform: ImageTransform;
  fromPreset: boolean;
} {
  const preset = variants.find(
    (variant) => variant.slug === THUMBNAIL_PRESET_SLUG,
  );
  if (!preset || preset.issues.length > 0)
    return { transform: FALLBACK_THUMBNAIL, fromPreset: false };
  return { transform: preset.transform, fromPreset: true };
}

/** "256 × 256 · crop · q82 · auto format" */
export function describeTransform(transform: ImageTransform): string {
  const { width, height, fit, crop, quality, autoFormat } = transform;
  let size: string | null = null;
  if (width && height) size = `${width} × ${height}`;
  else if (width) size = `${width} wide`;
  else if (height) size = `${height} tall`;
  return [
    size,
    fit,
    crop && `crop ${crop}`,
    quality && `q${quality}`,
    autoFormat && "auto format",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Empty input unsets the field; any other number is written and validated by toPresetTransform. */
export function parsePresetInput(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** Returns a copy of the preset document with one field set, or removed when value is undefined. */
export function withPresetField<T extends object>(
  presetDocument: T,
  field: NumericPresetField,
  value: number | undefined,
): T {
  const next = { ...presetDocument } as Record<string, unknown>;
  if (value === undefined) delete next[field];
  else next[field] = value;
  return next as T;
}
