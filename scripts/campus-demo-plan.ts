import { createSetupPlan, STARTER_PRESETS } from "@assetlake/core";

// The deployed demo's setup documents. campus-demo-plan.test.ts pins them to the exact documents
// the live demo was seeded with, so changing this changes production on the next seed:reset.
export const campusDemoPlan = createSetupPlan({
  applicationSlug: "campus-demo",
  applicationName: "Campus Demo",
  environment: "demo",
  policy: {
    slug: "public-profile-images",
    name: "Public Profile Images",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFileSizeBytes: 5 * 1024 * 1024,
    requiresReview: false,
  },
  presets: [...STARTER_PRESETS],
});
