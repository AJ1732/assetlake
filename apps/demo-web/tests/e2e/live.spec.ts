import { expect, test } from "@playwright/test";

import { logIn, requirePasscode, uploadAvatar } from "./fixtures/playground";

test("an upload in one tab appears on /live in another within 10s, without a reload", async ({
  browser,
}) => {
  requirePasscode();
  const viewerContext = await browser.newContext();
  const uploaderContext = await browser.newContext();
  const viewer = await viewerContext.newPage();
  const uploader = await uploaderContext.newPage();

  await viewer.goto("/live");
  await expect(viewer.getByTestId("live-feed")).toHaveAttribute(
    "data-status",
    "ready",
  );
  let reloads = 0;
  viewer.on("framenavigated", (frame) => {
    if (frame === viewer.mainFrame()) reloads += 1;
  });

  await logIn(uploader);
  const image = await uploadAvatar(uploader);

  await expect(viewer.locator(`[data-image-id="${image.id}"]`)).toBeVisible({
    timeout: 10_000,
  });
  expect(reloads).toBe(0);

  await viewerContext.close();
  await uploaderContext.close();
});
