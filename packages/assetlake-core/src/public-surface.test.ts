import { describe, expect, it } from "vitest";

import * as root from "./index";
import { createScenario } from "./testing/scenario";

// Everything listed here is semver surface once published. A new name should be a decision, not
// a side effect of an export star.
describe("@assetlake/core public surface", () => {
  it("exports exactly these runtime values from the root", () => {
    expect(Object.keys(root).sort()).toEqual([
      "APPLICATION_ENVIRONMENTS",
      "AssetLakeError",
      "DOCUMENT_TYPES",
      "IDEMPOTENCY_HEADER",
      "IMAGE_CROP_MODES",
      "IMAGE_FIT_MODES",
      "IMAGE_PURPOSES",
      "IMAGE_STATUSES",
      "PRESET_QUALITY_RANGE",
      "RESPONSIVE_WIDTHS",
      "SANITY_DATASET_PATTERN",
      "SANITY_PROJECT_ID_PATTERN",
      "STARTER_POLICY",
      "STARTER_PRESETS",
      "TRANSFORMABLE_IMAGE_MIME_TYPES",
      "UPLOAD_FORM_FIELDS",
      "createAssetLake",
      "createJsonLogger",
      "createSetupPlan",
      "isAssetLakeError",
      "parseAssetLakeConfig",
      "planDocumentIds",
      "silentLogger",
      "toSetupDocuments",
    ]);
  });

  it("gives the facade exactly these operations", () => {
    const { assetLake } = createScenario();

    expect({
      images: Object.keys(assetLake.images).sort(),
      presets: Object.keys(assetLake.presets).sort(),
      setup: Object.keys(assetLake.setup).sort(),
    }).toEqual({
      images: [
        "countUploadsForEntity",
        "countUploadsSince",
        "delete",
        "findLatestForEntity",
        "responsive",
        "transitionStatus",
        "upload",
        "uploadFromUrl",
        "url",
      ],
      presets: ["get", "list"],
      setup: ["ensure", "missing"],
    });
  });
});
