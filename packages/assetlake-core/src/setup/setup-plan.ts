import { z } from "zod";

import {
  APPLICATION_ENVIRONMENTS,
  type ApplicationEnvironment,
  type ImageCropMode,
  type ImageFitMode,
  TRANSFORMABLE_IMAGE_MIME_TYPES,
  type TransformableImageMimeType,
} from "../constants";
import { imageTransformSchema } from "../delivery/transform";

export interface PolicySpec {
  slug: string;
  name: string;
  allowedMimeTypes: TransformableImageMimeType[];
  maxFileSizeBytes: number;
  requiresReview: boolean;
}

export interface PresetSpec {
  slug: string;
  name: string;
  width?: number;
  height?: number;
  quality?: number;
  fit?: ImageFitMode;
  crop?: ImageCropMode;
  autoFormat?: boolean;
}

export interface SetupPlanInput {
  applicationSlug: string;
  applicationName?: string;
  environment?: ApplicationEnvironment;
  policy?: PolicySpec;
  /** Extra policies an app can pass as `policyId`; the application's default stays `policy`. */
  additionalPolicies?: PolicySpec[];
  presets?: PresetSpec[];
}

export interface SetupPlan {
  application: {
    id: string;
    slug: string;
    name: string;
    environment: ApplicationEnvironment;
  };
  policy: PolicySpec & { id: string };
  additionalPolicies: Array<PolicySpec & { id: string }>;
  presets: Array<PresetSpec & { id: string }>;
}

export const STARTER_POLICY: PolicySpec = {
  slug: "public-images",
  name: "Public images",
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFileSizeBytes: 5 * 1024 * 1024,
  requiresReview: false,
};

export const STARTER_PRESETS: readonly PresetSpec[] = [
  {
    slug: "avatar-sm",
    name: "Avatar small",
    width: 96,
    height: 96,
    fit: "crop",
    quality: 80,
    autoFormat: true,
  },
  {
    slug: "avatar",
    name: "Avatar",
    width: 256,
    height: 256,
    fit: "crop",
    quality: 82,
    autoFormat: true,
  },
  {
    slug: "card",
    name: "Card",
    width: 640,
    height: 360,
    fit: "crop",
    quality: 80,
    autoFormat: true,
  },
  {
    slug: "hero",
    name: "Hero",
    width: 1600,
    height: 900,
    fit: "max",
    quality: 82,
    autoFormat: true,
  },
];

// Slugs become document ids. No "." (dotted ids are private paths that tokenless reads of a public
// dataset can't see) and no "_" or uppercase, so an id always reads assetlake-<kind>-<slug>.
const slugSchema = z
  .string()
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/);
const nameSchema = z.string().trim().min(1);

const policySchema = z.object({
  slug: slugSchema,
  name: nameSchema,
  allowedMimeTypes: z.array(z.enum(TRANSFORMABLE_IMAGE_MIME_TYPES)).min(1),
  maxFileSizeBytes: z.number().int().positive(),
  requiresReview: z.boolean(),
});

const presetSchema = imageTransformSchema.extend({
  slug: slugSchema,
  name: nameSchema,
});

const hasUniqueSlugs = (specs: Array<{ slug: string }>) =>
  new Set(specs.map((spec) => spec.slug)).size === specs.length;

const setupPlanInputSchema = z
  .object({
    applicationSlug: slugSchema,
    applicationName: nameSchema.optional(),
    environment: z.enum(APPLICATION_ENVIRONMENTS).default("production"),
    // prefault, not default: the starter values go through the same validation as caller input.
    policy: policySchema.prefault(STARTER_POLICY),
    additionalPolicies: z.array(policySchema).default([]),
    presets: z
      .array(presetSchema)
      .prefault([...STARTER_PRESETS])
      .refine(hasUniqueSlugs, "preset slugs must be unique"),
  })
  .refine(
    ({ policy, additionalPolicies }) =>
      hasUniqueSlugs([policy, ...additionalPolicies]),
    {
      message: "policy slugs must be unique",
      path: ["additionalPolicies"],
    },
  );

const documentId = (kind: "application" | "policy" | "preset", slug: string) =>
  `assetlake-${kind}-${slug}`;

/** Validates setup input and fixes every document id, so init and the seed are idempotent. */
export function createSetupPlan(input: SetupPlanInput): SetupPlan {
  const parsed = setupPlanInputSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.issues.map(
      (issue) => issue.path.join(".") || "(root)",
    );
    throw new Error(`Invalid setup plan: ${[...new Set(fields)].join(", ")}`);
  }
  const {
    applicationSlug,
    applicationName,
    environment,
    policy,
    additionalPolicies,
    presets,
  } = parsed.data;
  const withPolicyId = (spec: PolicySpec) => ({
    id: documentId("policy", spec.slug),
    ...spec,
  });

  return {
    application: {
      id: documentId("application", applicationSlug),
      slug: applicationSlug,
      name: applicationName ?? applicationSlug,
      environment,
    },
    policy: withPolicyId(policy),
    additionalPolicies: additionalPolicies.map(withPolicyId),
    presets: presets.map((preset) => ({
      id: documentId("preset", preset.slug),
      ...preset,
    })),
  };
}

export function planPolicies(plan: SetupPlan) {
  return [plan.policy, ...plan.additionalPolicies];
}

/** Referenced documents come before the application that points at them. */
export function planDocumentIds(plan: SetupPlan): string[] {
  return [
    ...planPolicies(plan).map((policy) => policy.id),
    ...plan.presets.map((preset) => preset.id),
    plan.application.id,
  ];
}
