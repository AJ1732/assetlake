import type {
  ApiSuccess,
  AssetLakeImageResult,
} from "@assetlake/core/contracts";
import { expect, type Page, test } from "@playwright/test";

import { generatePng } from "./generate-image";

const DEMO_PASSCODE = process.env.ASSETLAKE_DEMO_PASSCODE;

export function requirePasscode() {
  test.skip(
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

export async function uploadAvatar(page: Page): Promise<AssetLakeImageResult> {
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
  expect(response.status()).toBe(201);
  const body = (await response.json()) as ApiSuccess<AssetLakeImageResult>;
  return body.data;
}

/** "image-<hash>-512x512-png" -> "<hash>", the part every transformed URL path shares. */
export const assetHash = (assetId: string) => assetId.split("-")[1];
