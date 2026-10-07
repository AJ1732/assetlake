import { describe, expect, it } from "vitest";

import type { UploadImageFromUrlInput } from "../contracts";
import type { PolicyRecord } from "../store/asset-lake-store";
import { createPngBytes, signatureBytes } from "../testing/image-fixtures";
import { APPLICATION_ID, createScenario } from "../testing/scenario";

const SIGNATURE = "X-Amz-Signature=0123456789abcdef";
const SOURCE = `https://uploads.example.com/photo.png?${SIGNATURE}`;
const remoteConfig = {
  remoteUploads: { allowedHosts: ["uploads.example.com"] },
};

const input = (
  overrides: Partial<UploadImageFromUrlInput> = {},
): UploadImageFromUrlInput => ({
  url: SOURCE,
  filename: "photo.png",
  applicationId: APPLICATION_ID,
  purpose: "avatar",
  entity: { type: "user", id: "user-demo-001" },
  actorId: "user-demo-001",
  ...overrides,
});

function remoteScenario(
  policy: Partial<PolicyRecord> = {},
  bytes: Uint8Array = createPngBytes(600, 400),
) {
  const scenario = createScenario({ policy, config: remoteConfig });
  scenario.store.serveRemote(SOURCE, bytes);
  return scenario;
}

const httpError = (statusCode: number) =>
  Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });

describe("images.uploadFromUrl", () => {
  it("stores the fetched image and creates a ready record", async () => {
    const { assetLake, store, events } = remoteScenario();

    const result = await assetLake.images.uploadFromUrl(input());

    expect(result).toMatchObject({
      status: "ready",
      mimeType: "image/png",
      width: 600,
      height: 400,
    });
    expect(store.images.get(result.id)).toMatchObject({
      assetId: result.assetId,
      entity: { type: "user", id: "user-demo-001" },
    });
    expect(events()).toEqual([
      "ASSET_UPLOAD_STARTED",
      "ASSET_UPLOAD_COMPLETED",
    ]);
  });

  it("rejects a host off the list before asking Sanity to fetch anything", async () => {
    const { assetLake, store, events } = remoteScenario();

    await expect(
      assetLake.images.uploadFromUrl(
        input({ url: "https://evil.example.org/photo.png" }),
      ),
    ).rejects.toMatchObject({ code: "SOURCE_URL_NOT_ALLOWED" });
    expect(store.callCount("uploadImageAssetFromUrl")).toBe(0);
    expect(events()).toEqual(["ASSET_UPLOAD_STARTED", "ASSET_UPLOAD_REJECTED"]);
  });

  it("is off when no hosts are configured", async () => {
    const { assetLake, store } = createScenario();
    store.serveRemote(SOURCE, createPngBytes(10, 10));

    await expect(assetLake.images.uploadFromUrl(input())).rejects.toMatchObject(
      { code: "SOURCE_URL_NOT_ALLOWED" },
    );
    expect(store.callCount("uploadImageAssetFromUrl")).toBe(0);
  });

  it.each([
    [
      "larger than the policy allows",
      { maxFileSizeBytes: 100 },
      createPngBytes(600, 400),
      "FILE_TOO_LARGE",
    ],
    [
      "a type the policy does not allow",
      {},
      signatureBytes("image/gif"),
      "UNSUPPORTED_IMAGE_TYPE",
    ],
    [
      "narrower than the policy allows",
      { minWidth: 1000 },
      createPngBytes(600, 400),
      "DIMENSIONS_OUT_OF_RANGE",
    ],
  ])(
    "deletes a fetched file that is %s and creates no record",
    async (_label, policy, bytes, code) => {
      const { assetLake, store, events } = remoteScenario(policy, bytes);

      await expect(
        assetLake.images.uploadFromUrl(input()),
      ).rejects.toMatchObject({ code });
      expect(store.assets.size).toBe(0);
      expect(store.images.size).toBe(0);
      expect(events()).toContain("ASSET_COMPENSATION_DELETED");
    },
  );

  it.each([
    [
      "an unreachable source (Sanity answers 400)",
      undefined,
      "SOURCE_FETCH_FAILED",
    ],
    [
      "a source Sanity cannot decode (422)",
      httpError(422),
      "UNSUPPORTED_IMAGE_TYPE",
    ],
    ["a source over Sanity's limit (413)", httpError(413), "FILE_TOO_LARGE"],
    ["a rejected token (401)", httpError(401), "UPLOAD_FAILED"],
    ["a fetch timeout (504)", httpError(504), "SOURCE_FETCH_FAILED"],
  ])("maps %s to %s", async (_label, failure, code) => {
    const { assetLake, store } = failure
      ? remoteScenario()
      : createScenario({ config: remoteConfig });
    if (failure) store.failNext("uploadImageAssetFromUrl", failure);

    await expect(assetLake.images.uploadFromUrl(input())).rejects.toMatchObject(
      { code },
    );
  });

  it("flags a timed-out fetch as possibly created, so callers check before retrying", async () => {
    const { assetLake, store, entries } = remoteScenario();
    store.failNext("uploadImageAssetFromUrl", httpError(504));

    await assetLake.images.uploadFromUrl(input()).catch(() => undefined);

    expect(entries).toContainEqual(
      expect.objectContaining({
        event: "ASSET_UPLOAD_FAILED",
        fields: expect.objectContaining({ mayExist: true }),
      }),
    );
  });

  it("replays an idempotent retry without fetching again", async () => {
    const { assetLake, store } = remoteScenario();
    const first = await assetLake.images.uploadFromUrl(
      input({ idempotencyKey: "retry-1" }),
    );

    const second = await assetLake.images.uploadFromUrl(
      input({ idempotencyKey: "retry-1" }),
    );

    expect(second.id).toBe(first.id);
    expect(store.callCount("uploadImageAssetFromUrl")).toBe(1);
  });

  it("logs the source host but never the URL or its signature", async () => {
    const { assetLake, store, entries } = remoteScenario({
      maxFileSizeBytes: 100,
    });
    await assetLake.images.uploadFromUrl(input()).catch(() => undefined);
    store.failNext("uploadImageAssetFromUrl", httpError(504));
    await assetLake.images.uploadFromUrl(input()).catch(() => undefined);

    const logged = JSON.stringify(entries);
    expect(logged).toContain('"sourceHost":"uploads.example.com"');
    expect(logged).not.toContain("0123456789abcdef");
    expect(logged).not.toContain("/photo.png");
  });
});
