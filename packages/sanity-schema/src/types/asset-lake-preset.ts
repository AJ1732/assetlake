import {
  DOCUMENT_TYPES,
  IMAGE_CROP_MODES,
  IMAGE_FIT_MODES,
  PRESET_QUALITY_RANGE,
} from "@assetlake/core/contracts";
import { CropIcon } from "@sanity/icons/Crop";
import { defineField, defineType } from "@sanity/types";

import { positiveInteger } from "./field-rules";

// Declarative delivery rule; @assetlake/core maps it onto @sanity/image-url. Width/height must be
// integers: the image pipeline warns non-integer values can time out.
export const assetLakePreset = defineType({
  name: DOCUMENT_TYPES.preset,
  title: "AssetLake delivery preset",
  type: "document",
  icon: CropIcon,
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
    defineField({ name: "width", type: "number", validation: positiveInteger }),
    defineField({
      name: "height",
      type: "number",
      validation: positiveInteger,
    }),
    defineField({
      name: "fit",
      type: "string",
      options: { list: [...IMAGE_FIT_MODES] },
    }),
    defineField({
      name: "quality",
      type: "number",
      validation: (rule) =>
        rule
          .integer()
          .min(PRESET_QUALITY_RANGE.min)
          .max(PRESET_QUALITY_RANGE.max),
    }),
    defineField({
      name: "autoFormat",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "crop",
      type: "string",
      description: "Only applies when fit is crop.",
      options: { list: [...IMAGE_CROP_MODES] },
    }),
  ],
  preview: {
    select: { title: "name", width: "width", height: "height", fit: "fit" },
    prepare: ({ title, width, height, fit }) => ({
      title,
      subtitle: [
        width && height ? `${width}x${height}` : (width ?? height),
        fit,
      ]
        .filter(Boolean)
        .join(" · "),
    }),
  },
});
