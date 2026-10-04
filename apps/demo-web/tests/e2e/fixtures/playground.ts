import type {
  ApiSuccess,
  AssetLakeImageResult,
} from "@assetlake/core/contracts";
import {
  type BrowserContext,
  expect,
  type Page,
  test as base,
} from "@playwright/test";

import { generatePng } from "./generate-image";

const DEMO_PASSCODE = process.env.ASSETLAKE_DEMO_PASSCODE;

type SessionState = Awaited<ReturnType<BrowserContext["storageState"]>>;

export interface UploadTracker {
  track(page: Page, imageId: string): Promise<void>;
}

/**
 * Specs upload into the public production dataset (/live reads it), so every upload is deleted
 * through DELETE /api/assets/images/[id] after the test, pass or fail. The uploader's cookies are
 * captured at upload time because the spec may have closed its pages by teardown.
 */
export const test = base.extend<{ uploads: UploadTracker }>({
  // Playwright passes the fixture callback positionally; naming it `use` trips react-hooks/rules-of-hooks.
  uploads: async ({ playwright, baseURL }, provide) => {
    const tracked: Array<{ imageId: string; session: SessionState }> = [];
    await provide({
      track: async (page, imageId) => {
        tracked.push({ imageId, session: await page.context().storageState() });
      },
    });
    for (const { imageId, session } of tracked) {
      const api = await playwright.request.newContext({
        baseURL,
        storageState: session,
      });
      const response = await api.delete(`/api/assets/images/${imageId}`);
      await api.dispose();
      expect(response.status(), `cleanup of ${imageId}`).toBe(204);
    }
  },
});

export { expect };

export function requirePasscode() {
  base.skip(
    !DEMO_PASSCODE,
    "Set ASSETLAKE_DEMO_PASSCODE to run specs that log in and upload.",
  );
}

export async function logIn(page: Page) {
  await page.goto("/playground");
  await page.getByLabel("Demo passcode", { exact: true }).fill(DEMO_PASSCODE!);
  await page.getByRole("button", { name: "Enter the playground" }).click();
  await expect(page.getByTestId("upload-panel")).toBeVisible();
}

export async function uploadAvatar(
  page: Page,
  uploads: UploadTracker,
): Promise<AssetLakeImageResult> {
  await page
    .getByLabel("Choose an image", { exact: true })
    .setInputFiles(generatePng());
  await page
    .getByLabel("Alt text", { exact: true })
    .fill("Generated test avatar");
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/assets/images") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  const response = await responsePromise;
  const body = (await response.json()) as ApiSuccess<AssetLakeImageResult>;
  if (body.success) await uploads.track(page, body.data.id);
  expect(response.status()).toBe(201);
  return body.data;
}

/** "image-<hash>-512x512-png" -> "<hash>", the part every transformed URL path shares. */
export const assetHash = (assetId: string) => assetId.split("-")[1];
