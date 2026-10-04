import { LockIcon } from "@sanity/icons/Lock";
import {
  defineArrayMember,
  defineField,
  defineType,
  type ValidationContext,
} from "@sanity/types";

import { DOCUMENT_TYPES, TRANSFORMABLE_IMAGE_MIME_TYPES } from "../constants";
import { positiveInteger } from "./fieldRules";

const notBelowMinimum =
  (minField: "minWidth" | "minHeight") =>
  (value: number | undefined, context: ValidationContext) => {
    const minimum = context.document?.[minField];
    if (value === undefined || typeof minimum !== "number") return true;
    return value >= minimum || `Must be at least ${minField} (${minimum})`;
  };

// Enforced by the trusted backend (@assetlake/core), never by the browser.
export const assetLakePolicy = defineType({
  name: DOCUMENT_TYPES.policy,
  title: "AssetLake upload policy",
  type: "document",
  icon: LockIcon,
  fields: [
    defineField({
      name: "name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "name" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "allowedMimeTypes",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { list: [...TRANSFORMABLE_IMAGE_MIME_TYPES] },
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: "maxFileSizeBytes",
      type: "number",
      validation: (rule) => positiveInteger(rule).required(),
    }),
    defineField({
      name: "minWidth",
      type: "number",
      validation: positiveInteger,
    }),
    defineField({
      name: "minHeight",
      type: "number",
      validation: positiveInteger,
    }),
    defineField({
      name: "maxWidth",
      type: "number",
      validation: (rule) =>
        positiveInteger(rule).custom(notBelowMinimum("minWidth")),
    }),
    defineField({
      name: "maxHeight",
      type: "number",
      validation: (rule) =>
        positiveInteger(rule).custom(notBelowMinimum("minHeight")),
    }),
    defineField({
      name: "requiresReview",
      type: "boolean",
      initialValue: false,
      description:
        "Review governs application lifecycle, not confidentiality. Uploaded assets are public by URL.",
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "slug.current" },
  },
});
