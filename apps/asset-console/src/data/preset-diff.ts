import type { PresetFieldName } from "./preset-transform";
import type { PresetDocument, PresetFields, PresetRow } from "./types";

export const PRESET_FIELDS: readonly PresetFieldName[] = [
  "width",
  "height",
  "fit",
  "crop",
  "quality",
  "autoFormat",
];

export type PresetFieldValue = PresetFields[PresetFieldName];

export interface PresetFieldChange {
  field: PresetFieldName;
  published: PresetFieldValue;
  draft: PresetFieldValue;
}

const normalize = (value: PresetFieldValue) => value ?? null;

/**
 * The preset as the draft defines it, in row shape. Copies transform fields one by one: spreading
 * the raw document would put Sanity's {current} slug object where a string belongs, and a field
 * unset in the draft must stay unset rather than fall back to the published value.
 */
export function draftRow(
  published: PresetRow,
  draft: PresetDocument,
): PresetRow {
  const row: PresetRow = {
    id: published.id,
    slug: published.slug,
    name: draft.name ?? published.name,
  };
  for (const field of PRESET_FIELDS)
    Object.assign(row, { [field]: normalize(draft[field]) });
  return row;
}

/** Fields where the draft differs from the published preset. A never-published preset diffs against nothing. */
export function presetChanges(
  draft: PresetFields,
  published: PresetFields | undefined,
): PresetFieldChange[] {
  return PRESET_FIELDS.flatMap((field) => {
    const draftValue = normalize(draft[field]);
    const publishedValue = normalize(published?.[field]);
    return draftValue === publishedValue
      ? []
      : [{ field, published: publishedValue, draft: draftValue }];
  });
}

export function formatFieldValue(value: PresetFieldValue): string {
  if (value === null || value === undefined) return "unset";
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
}

/** "quality 82 → 60" */
export const describeChange = (change: PresetFieldChange) =>
  `${change.field} ${formatFieldValue(change.published)} → ${formatFieldValue(change.draft)}`;
