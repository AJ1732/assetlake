import { existsSync } from "node:fs";

import { createPngBytes } from "@assetlake/core/testing";
import { expect, test } from "@playwright/test";

// The dev server reads apps/demo-web/.env.local itself; this only gives the test runner the
// passcode. Variables already exported in the shell (SANITY_DATASET=test) are never overridden.
if (!process.env.ASSETLAKE_DEMO_PASSCODE && existsSync(".env.local"))
  process.loadEnvFile(".env.local");

const PASSCODE = process.env.ASSETLAKE_DEMO_PASSCODE;
const EXPECTED_DATASET = "test";

test.describe.configure({ mode: "serial" });

test("login, upload to the test dataset, fetch from the CDN, delete", async ({
  request,
}) => {
  test.skip(!PASSCODE, "ASSETLAKE_DEMO_PASSCODE is not available");

  const login = await request.post("/api/session", {
    data: { passcode: PASSCODE },
  });
  expect(login.status()).toBe(200);

  const runId = `${Date.now()}`;
  const upload = await request.post("/api/assets/images", {
    multipart: {
      file: {
        name: `e2e-${runId}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(createPngBytes(64, 64, Date.now() % 256)),
      },
      purpose: "avatar",
      alt: "Playwright API spec",
    },
    headers: { "Idempotency-Key": `e2e-${runId}` },
  });
  expect(upload.status(), await upload.text()).toBe(201);
  const { data } = await upload.json();

  try {
    const url = new URL(data.url);
    expect(url.host).toBe("cdn.sanity.io");
    // /images/<projectId>/<dataset>/<file>: fail loudly if the server points at production.
    expect(url.pathname.split("/")[3]).toBe(EXPECTED_DATASET);

    const cdn = await request.get(data.url);
    expect(cdn.status()).toBe(200);
  } finally {
    const removal = await request.delete(`/api/assets/images/${data.id}`);
    expect(removal.status()).toBe(204);
  }
});
