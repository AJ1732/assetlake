import {
  expect,
  logIn,
  requirePasscode,
  test,
  uploadAvatar,
} from "./fixtures/playground";

test("an upload in one tab appears on /live in another within 10s, without a reload", async ({
  browser,
  uploads,
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
  const image = await uploadAvatar(uploader, uploads);

  const tile = viewer.locator(`[data-image-id="${image.id}"]`);
  await expect(tile).toBeVisible({ timeout: 10_000 });
  expect(reloads).toBe(0);

  // The project reaches the browser as a Server Component prop (B10b), so the feed and its CDN
  // URLs must follow SANITY_PROJECT_ID, not a constant in the bundle.
  const target = await viewer
    .getByTestId("live-feed")
    .getAttribute("data-sanity-target");
  // `|| default`, not `??`: a sourced .env.local can export SANITY_PROJECT_ID as "".
  expect(target?.split("/")[0]).toBe(
    process.env.SANITY_PROJECT_ID?.trim() || "oshzwvjy",
  );
  await expect(tile.locator("img")).toHaveAttribute(
    "src",
    new RegExp(`^https://cdn\\.sanity\\.io/images/${target}/`),
  );

  await viewerContext.close();
  await uploaderContext.close();
});

test("opening /live after an upload's live event has passed still shows the upload", async ({
  browser,
  uploads,
}) => {
  requirePasscode();
  const viewerContext = await browser.newContext();
  const probeContext = await browser.newContext();
  const uploaderContext = await browser.newContext();
  const viewer = await viewerContext.newPage();
  const probe = await probeContext.newPage();
  const uploader = await uploaderContext.newPage();

  // The viewer caches the pre-upload list (the API CDN sends max-age=60), then leaves /live.
  await viewer.goto("/live");
  await expect(viewer.getByTestId("live-feed")).toHaveAttribute(
    "data-status",
    "ready",
  );
  await viewer.goto("/");

  await probe.goto("/live");
  await logIn(uploader);
  const image = await uploadAvatar(uploader, uploads);
  const tile = `[data-image-id="${image.id}"]`;
  // Once the probe shows the tile, the upload's live event is over, so no later event can rescue
  // a stale first load in the viewer.
  await expect(probe.locator(tile)).toBeVisible({ timeout: 15_000 });

  await viewer.goto("/live");
  await expect(viewer.locator(tile)).toBeVisible({ timeout: 5000 });

  await viewerContext.close();
  await probeContext.close();
  await uploaderContext.close();
});
