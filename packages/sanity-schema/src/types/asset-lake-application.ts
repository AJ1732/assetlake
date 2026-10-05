import {
  APPLICATION_ENVIRONMENTS,
  DOCUMENT_TYPES,
} from "@assetlake/core/contracts";
import { PackageIcon } from "@sanity/icons/Package";
import { defineArrayMember, defineField, defineType } from "@sanity/types";

// Never store secrets here: the dataset is public (handoff §8.1).
export const assetLakeApplication = defineType({
  name: DOCUMENT_TYPES.application,
  title: "AssetLake application",
  type: "document",
  icon: PackageIcon,
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
      name: "environment",
      type: "string",
      options: { list: [...APPLICATION_ENVIRONMENTS], layout: "radio" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "defaultPolicy",
      type: "reference",
      to: [{ type: DOCUMENT_TYPES.policy }],
    }),
    defineField({
      name: "presets",
      type: "array",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: DOCUMENT_TYPES.preset }],
        }),
      ],
      validation: (rule) => rule.unique(),
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "environment" },
  },
});
