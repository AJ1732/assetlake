import { ImageIcon } from "@sanity/icons/Image";
import { defineArrayMember, defineField, defineType } from "@sanity/types";

import { DOCUMENT_TYPES, IMAGE_PURPOSES, IMAGE_STATUSES } from "../constants";

// Application meaning around a sanity.imageAsset. URL, dimensions, MIME and size are deliberately
// not copied here: dereference image.asset so there is one source of truth (handoff §8.4).
export const assetLakeImage = defineType({
  name: DOCUMENT_TYPES.image,
  title: "AssetLake image",
  type: "document",
  icon: ImageIcon,
  fields: [
    defineField({
      name: "image",
      type: "image",
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "application",
      type: "reference",
      to: [{ type: DOCUMENT_TYPES.application }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "policy",
      type: "reference",
      to: [{ type: DOCUMENT_TYPES.policy }],
    }),
    defineField({
      name: "purpose",
      type: "string",
      options: { list: [...IMAGE_PURPOSES] },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "entity",
      type: "object",
      description:
        "Logical owner in the consuming app. Demo identifiers only: this dataset is public.",
      fields: [
        defineField({ name: "type", type: "string" }),
        defineField({ name: "id", type: "string" }),
      ],
    }),
    defineField({ name: "alt", type: "string" }),
    defineField({
      name: "tags",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: "status",
      type: "string",
      options: { list: [...IMAGE_STATUSES], layout: "radio" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "uploadedAt",
      type: "datetime",
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "idempotencyKeyHash",
      type: "string",
      readOnly: true,
      description:
        "SHA-256 of actor + Idempotency-Key. Lets a retried upload return this record instead of creating a duplicate.",
    }),
  ],
  preview: {
    select: {
      purpose: "purpose",
      status: "status",
      entityId: "entity.id",
      media: "image",
    },
    prepare: ({ purpose, status, entityId, media }) => ({
      title: [purpose, entityId].filter(Boolean).join(" · "),
      subtitle: status,
      media,
    }),
  },
});
