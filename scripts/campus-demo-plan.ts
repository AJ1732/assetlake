import {
  createSetupPlan,
  type PolicySpec,
  STARTER_PRESETS,
} from "@assetlake/core";

const profileImages: PolicySpec = {
  slug: "public-profile-images",
  name: "Public Profile Images",
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFileSizeBytes: 5 * 1024 * 1024,
  requiresReview: false,
};

// The deployed demo's setup documents. campus-demo-plan.test.ts pins them to the exact documents
// the live demo was seeded with, so changing this changes production on the next seed:reset.
// demo-web's "Hold for review" uploads use the reviewed policy (B08).
export const campusDemoPlan = createSetupPlan({
  applicationSlug: "campus-demo",
  applicationName: "Campus Demo",
  environment: "demo",
  policy: profileImages,
  additionalPolicies: [
    {
      ...profileImages,
      slug: "reviewed-profile-images",
      name: "Reviewed Profile Images",
      requiresReview: true,
    },
  ],
  presets: [...STARTER_PRESETS],
});
