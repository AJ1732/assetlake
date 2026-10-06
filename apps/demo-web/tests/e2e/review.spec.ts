import type {
  ApiSuccess,
  AssetLakeImageResult,
} from "@assetlake/core/contracts";

import { generatePng } from "./fixtures/generate-image";
import { expect, logIn, requirePasscode, test } from "./fixtures/playground";

// The upload is intercepted: a real held upload in production would start a review workflow that
// this spec's cleanup could not close. The server half is covered by the upload-route gate tests
// and image-review's live eval.
const HELD: AssetLakeImageResult = {
  id: "assetlake-image-e2e-held",
  assetId: "image-0000000000000000000000000000000000000000-8x8-png",
  url: "https://cdn.sanity.io/images/oshzwvjy/production/0000000000000000000000000000000000000000-8x8.png",
  mimeType: "image/png",
  size: 100,
  width: 8,
  height: 8,
  aspectRatio: 1,
  lqip: null,
  blurHash: null,
  status: "review",
};

test.describe("hold for review", () => {
  test.beforeEach(() => requirePasscode());

  test("sends the review flag and says the image waits for a reviewer", async ({
    page,
  }) => {
    await logIn(page);
    const avatar = page
      .getByTestId("profile-card")
      .locator("[data-assetlake-image]");
    const avatarBefore = (await avatar.count())
      ? await avatar.getAttribute("src")
      : null;

    let sentReview = false;
    await page.route("**/api/assets/images", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      sentReview = /name="review"\r\n\r\non\r\n/.test(
        route.request().postData() ?? "",
      );
      const body: ApiSuccess<AssetLakeImageResult> = {
        success: true,
        data: HELD,
      };
      await route.fulfill({ status: 201, json: body });
    });

    await page
      .getByLabel("Choose an image", { exact: true })
      .setInputFiles(generatePng());
    await page.getByLabel("Hold for review").check();
    await page.getByRole("button", { name: "Upload", exact: true }).click();

    await expect(page.getByText("Held for review.")).toBeVisible();
    expect(sentReview).toBe(true);
    if (avatarBefore) await expect(avatar).toHaveAttribute("src", avatarBefore);
    else await expect(avatar).toHaveCount(0);
  });
});
