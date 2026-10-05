import { describe, expect, it } from "vitest";

import { createSetupPlan, planDocumentIds } from "./setup-plan";

const thumb = { slug: "thumb", name: "Thumb", width: 100, height: 100 };

describe("createSetupPlan", () => {
  it("derives assetlake-<kind>-<slug> ids for every document", () => {
    const plan = createSetupPlan({
      applicationSlug: "shop",
      policy: {
        slug: "uploads",
        name: "Uploads",
        allowedMimeTypes: ["image/png"],
        maxFileSizeBytes: 1000,
        requiresReview: false,
      },
      presets: [thumb],
    });

    expect(plan.application.id).toBe("assetlake-application-shop");
    expect(plan.policy.id).toBe("assetlake-policy-uploads");
    expect(plan.presets.map((preset) => preset.id)).toEqual([
      "assetlake-preset-thumb",
    ]);
  });

  it("defaults to the starter policy, the four starter presets and production", () => {
    const plan = createSetupPlan({ applicationSlug: "my-app" });

    expect(plan.application).toEqual({
      id: "assetlake-application-my-app",
      slug: "my-app",
      name: "my-app",
      environment: "production",
    });
    expect(plan.policy).toEqual({
      id: "assetlake-policy-public-images",
      slug: "public-images",
      name: "Public images",
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFileSizeBytes: 5_242_880,
      requiresReview: false,
    });
    expect(plan.presets.map((preset) => preset.id)).toEqual([
      "assetlake-preset-avatar-sm",
      "assetlake-preset-avatar",
      "assetlake-preset-card",
      "assetlake-preset-hero",
    ]);
  });

  it.each(["", "My-App", "-app", "my.app", "my_app", "a".repeat(65)])(
    "rejects application slug %j",
    (applicationSlug) => {
      expect(() => createSetupPlan({ applicationSlug })).toThrow(
        "Invalid setup plan: applicationSlug",
      );
    },
  );

  it.each([
    ["a dotted slug", { ...thumb, slug: "has.dot" }, "presets.0.slug"],
    ["a fractional width", { ...thumb, width: 1.5 }, "presets.0.width"],
    ["an unknown fit", { ...thumb, fit: "stretch" }, "presets.0.fit"],
    ["quality above 100", { ...thumb, quality: 101 }, "presets.0.quality"],
  ])("rejects a preset with %s", (_label, preset, field) => {
    expect(() =>
      createSetupPlan({
        applicationSlug: "shop",
        presets: [preset as typeof thumb],
      }),
    ).toThrow(`Invalid setup plan: ${field}`);
  });

  it("rejects two presets with the same slug, which would share one document id", () => {
    expect(() =>
      createSetupPlan({ applicationSlug: "shop", presets: [thumb, thumb] }),
    ).toThrow("Invalid setup plan: presets");
  });

  it("rejects a policy that allows a type the image pipeline cannot transform", () => {
    expect(() =>
      createSetupPlan({
        applicationSlug: "shop",
        policy: {
          slug: "uploads",
          name: "Uploads",
          allowedMimeTypes: ["image/svg+xml" as "image/png"],
          maxFileSizeBytes: 1000,
          requiresReview: false,
        },
      }),
    ).toThrow("Invalid setup plan: policy.allowedMimeTypes.0");
  });

  it("rejects an unknown environment", () => {
    expect(() =>
      createSetupPlan({
        applicationSlug: "shop",
        environment: "prod" as "production",
      }),
    ).toThrow("Invalid setup plan: environment");
  });
});

describe("planDocumentIds", () => {
  it("lists the policy, then the presets, then the application that references them", () => {
    const plan = createSetupPlan({ applicationSlug: "shop", presets: [thumb] });

    expect(planDocumentIds(plan)).toEqual([
      "assetlake-policy-public-images",
      "assetlake-preset-thumb",
      "assetlake-application-shop",
    ]);
  });
});
