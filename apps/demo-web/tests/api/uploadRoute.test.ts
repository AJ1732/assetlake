import { AssetLakeError, IDEMPOTENCY_HEADER } from "@assetlake/core";
import { createPngBytes, signatureBytes } from "@assetlake/core/testing";
import { describe, expect, it, vi } from "vitest";

import {
  MAX_UPLOAD_REQUEST_BYTES,
  uploadImage,
} from "@/lib/server/http/uploadImageHandler";
import { GENERIC_SERVER_MESSAGE } from "@/lib/server/httpErrors";

import {
  APPLICATION_ID,
  createTestContext,
  expectFailure,
  RESULT_KEYS,
  TEST_TOKEN,
  type TestContext,
  uploadRequest,
} from "./support/fixtures";

async function signedInUpload(
  context: TestContext,
  options: Parameters<typeof uploadRequest>[0] = {},
) {
  const { session, cookie } = await context.signIn();
  const result = await uploadImage(
    await uploadRequest({ cookie, ...options }),
    context.dependencies,
  );
  return { ...result, session, cookie };
}

describe("POST /api/assets/images: authentication", () => {
  it("returns 401 without a cookie and never touches storage", async () => {
    const context = createTestContext();
    const reserve = vi.spyOn(context.dependencies.quota, "reserve");
    const { response, actorId } = await uploadImage(
      await uploadRequest(),
      context.dependencies,
    );

    await expectFailure(response, 401, "UNAUTHENTICATED");
    expect(actorId).toBeNull();
    expect(reserve).not.toHaveBeenCalled();
    expect(context.store.calls.uploadImageAsset).toBeUndefined();
  });

  it("returns 401 for a forged cookie", async () => {
    const context = createTestContext();
    const { response } = await uploadImage(
      await uploadRequest({
        cookie: "assetlake_session=eyJ1c2VySWQiOiJ4In0.AAAA",
      }),
      context.dependencies,
    );
    await expectFailure(response, 401, "UNAUTHENTICATED");
  });
});

describe("POST /api/assets/images: request envelope", () => {
  it("returns 413 from content-length alone, before formData() or quota", async () => {
    const context = createTestContext();
    const { cookie } = await context.signIn();
    const request = await uploadRequest({
      cookie,
      headers: { "content-length": String(MAX_UPLOAD_REQUEST_BYTES + 1) },
    });
    const formData = vi.spyOn(request, "formData");
    const reserve = vi.spyOn(context.dependencies.quota, "reserve");

    const { response } = await uploadImage(request, context.dependencies);

    await expectFailure(response, 413, "FILE_TOO_LARGE");
    expect(formData).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
  });

  it("accepts a request exactly at the envelope limit header", async () => {
    const context = createTestContext();
    const { cookie } = await context.signIn();
    const request = await uploadRequest({
      cookie,
      headers: { "content-length": String(MAX_UPLOAD_REQUEST_BYTES) },
    });
    const formData = vi
      .spyOn(request, "formData")
      .mockResolvedValue(new FormData());
    const { response } = await uploadImage(request, context.dependencies);
    expect(formData).toHaveBeenCalled();
    await expectFailure(response, 400, "BAD_REQUEST");
  });

  it("returns 400 when content-length is missing", async () => {
    const { response } = await signedInUpload(createTestContext(), {
      omitContentLength: true,
    });
    const error = await expectFailure(response, 400, "BAD_REQUEST");
    expect(error.message).toMatch(/Content-Length/);
  });

  it("returns 400 for a non-multipart body", async () => {
    const context = createTestContext();
    const { cookie } = await context.signIn();
    const request = new Request("http://localhost:3000/api/assets/images", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "content-length": "2",
      },
      body: "{}",
    });
    const { response } = await uploadImage(request, context.dependencies);
    await expectFailure(response, 400, "BAD_REQUEST");
  });
});

describe("POST /api/assets/images: validation", () => {
  it("rejects a GIF with 400 UNSUPPORTED_IMAGE_TYPE before storage", async () => {
    const context = createTestContext();
    const { response } = await signedInUpload(context, {
      bytes: signatureBytes("image/gif"),
      contentType: "image/gif",
      filename: "a.gif",
    });
    await expectFailure(response, 400, "UNSUPPORTED_IMAGE_TYPE");
    expect(context.store.calls.uploadImageAsset).toBeUndefined();
  });

  it("rejects JPEG bytes declared as PNG with 400 SIGNATURE_MISMATCH", async () => {
    const { response } = await signedInUpload(createTestContext(), {
      bytes: signatureBytes("image/jpeg"),
      contentType: "image/png",
    });
    await expectFailure(response, 400, "SIGNATURE_MISMATCH");
  });

  it("rejects a purpose outside the contract union", async () => {
    const { response } = await signedInUpload(createTestContext(), {
      purpose: "banner",
    });
    const error = await expectFailure(response, 400, "BAD_REQUEST");
    expect(error.message).toContain("purpose");
  });

  it("rejects an over-long Idempotency-Key", async () => {
    const { response } = await signedInUpload(createTestContext(), {
      headers: { [IDEMPOTENCY_HEADER]: "k".repeat(201) },
    });
    const error = await expectFailure(response, 400, "BAD_REQUEST");
    expect(error.message).toContain("idempotencyKey");
  });

  it("does not spend quota on rejected uploads", async () => {
    const context = createTestContext();
    const { cookie } = await context.signIn();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { response } = await uploadImage(
        await uploadRequest({ cookie, purpose: "banner" }),
        context.dependencies,
      );
      expect(response.status).toBe(400);
    }
    const { response } = await uploadImage(
      await uploadRequest({ cookie }),
      context.dependencies,
    );
    expect(response.status).toBe(201);
  });
});

describe("POST /api/assets/images: success", () => {
  it("returns 201 with exactly the AssetLakeImageResult keys", async () => {
    const context = createTestContext();
    const { response, session, actorId } = await signedInUpload(context, {
      alt: "  Portrait  ",
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Object.keys(body.data).sort()).toEqual(RESULT_KEYS);
    expect(new URL(body.data.url).host).toBe("cdn.sanity.io");
    expect(actorId).toBe(session.userId);

    const record = context.store.images.get(body.data.id);
    expect(record).toMatchObject({
      applicationId: APPLICATION_ID,
      purpose: "avatar",
      entity: { type: "user", id: session.userId },
      alt: "Portrait",
    });
  });

  it("forwards Idempotency-Key so a retry replays the first result", async () => {
    const context = createTestContext();
    const upload = vi.spyOn(context.dependencies.images, "upload");
    const { cookie, session } = await context.signIn();
    const send = async () =>
      uploadImage(
        await uploadRequest({
          cookie,
          headers: { [IDEMPOTENCY_HEADER]: "retry-1" },
        }),
        context.dependencies,
      );

    const first = await (await send()).response.json();
    const second = await (await send()).response.json();

    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "retry-1",
        actorId: session.userId,
        applicationId: APPLICATION_ID,
        entity: { type: "user", id: session.userId },
        contentType: "image/png",
        filename: "avatar.png",
      }),
    );
    expect(second.data.id).toBe(first.data.id);
    expect(context.store.images.size).toBe(1);
  });
});

describe("POST /api/assets/images: quotas", () => {
  it("returns 429 on the 6th upload in a session", async () => {
    const context = createTestContext();
    const { cookie } = await context.signIn();
    for (let seed = 1; seed <= 5; seed += 1) {
      const { response } = await uploadImage(
        await uploadRequest({ cookie, bytes: createPngBytes(8, 8, seed) }),
        context.dependencies,
      );
      expect(response.status).toBe(201);
    }

    const { response } = await uploadImage(
      await uploadRequest({ cookie, bytes: createPngBytes(8, 8, 6) }),
      context.dependencies,
    );
    await expectFailure(response, 429, "RATE_LIMITED");
    expect(context.store.calls.uploadImageAsset).toBe(5);
  });

  it("returns 429 once the global daily cap is reached", async () => {
    const context = createTestContext({ dailyCap: 2 });
    for (let seed = 1; seed <= 2; seed += 1) {
      const { response } = await signedInUpload(context, {
        bytes: createPngBytes(8, 8, seed),
      });
      expect(response.status).toBe(201);
    }
    const { response } = await signedInUpload(context);
    await expectFailure(response, 429, "RATE_LIMITED");
  });
});

describe("POST /api/assets/images: server faults", () => {
  it("hides unknown errors behind a generic 500 with no stack or upstream text", async () => {
    const context = createTestContext();
    const thrown = Object.assign(
      new Error(`Sanity said no for token ${TEST_TOKEN}`),
      { statusCode: 500, responseBody: `{"token":"${TEST_TOKEN}"}` },
    );
    vi.spyOn(context.dependencies.images, "upload").mockRejectedValue(thrown);

    const { response, error } = await signedInUpload(context);

    expect(response.status).toBe(500);
    expect(await response.clone().json()).toEqual({
      success: false,
      error: { code: "UPLOAD_FAILED", message: GENERIC_SERVER_MESSAGE },
    });
    const text = await response.text();
    expect(text).not.toContain(TEST_TOKEN);
    expect(text).not.toContain("stack");
    expect(text).not.toContain("Sanity said no");
    expect(error).toBe(thrown);
  });

  it("masks server-side AssetLakeError messages", async () => {
    const context = createTestContext();
    const { response } = await signedInUpload(
      {
        ...context,
        dependencies: {
          ...context.dependencies,
          applicationId: "assetlake-application-missing",
        },
      },
      {},
    );
    const error = await expectFailure(response, 500, "APPLICATION_NOT_FOUND");
    expect(error.message).toBe(GENERIC_SERVER_MESSAGE);
  });

  it("releases the quota slot when core fails", async () => {
    const context = createTestContext();
    vi.spyOn(context.dependencies.images, "upload").mockRejectedValue(
      new AssetLakeError("UPLOAD_FAILED", "The image could not be stored."),
    );
    const { cookie } = await context.signIn();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { response } = await uploadImage(
        await uploadRequest({ cookie }),
        context.dependencies,
      );
      expect(response.status).toBe(500);
    }
  });
});
