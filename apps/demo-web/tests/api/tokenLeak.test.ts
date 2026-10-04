import { signatureBytes } from "@assetlake/core/testing";
import { describe, it, vi } from "vitest";

import { deleteImage } from "@/lib/server/http/deleteImageHandler";
import { createSession } from "@/lib/server/http/sessionHandlers";
import {
  MAX_UPLOAD_REQUEST_BYTES,
  uploadImage,
} from "@/lib/server/http/uploadImageHandler";

import {
  createTestContext,
  deleteRequest,
  expectNoSecret,
  seedImage,
  sessionRequest,
  TEST_PASSCODE,
  TEST_TOKEN,
  uploadRequest,
} from "./support/fixtures";

type Scenario = [label: string, run: () => Promise<Response>];

async function signedIn(dailyCap?: number) {
  const context = createTestContext({ dailyCap });
  return { context, ...(await context.signIn()) };
}

const scenarios: Scenario[] = [
  [
    "session 401",
    async () =>
      (
        await createSession(
          sessionRequest({ passcode: "x" }),
          createTestContext().dependencies,
        )
      ).response,
  ],
  [
    "session 200",
    async () =>
      (
        await createSession(
          sessionRequest({ passcode: TEST_PASSCODE }),
          createTestContext().dependencies,
        )
      ).response,
  ],
  [
    "upload 401",
    async () =>
      (
        await uploadImage(
          await uploadRequest(),
          createTestContext().dependencies,
        )
      ).response,
  ],
  [
    "upload 400",
    async () => {
      const { context, cookie } = await signedIn();
      const request = await uploadRequest({
        cookie,
        bytes: signatureBytes("image/gif"),
        contentType: "image/gif",
      });
      return (await uploadImage(request, context.dependencies)).response;
    },
  ],
  [
    "upload 413",
    async () => {
      const { context, cookie } = await signedIn();
      const request = await uploadRequest({
        cookie,
        headers: { "content-length": String(MAX_UPLOAD_REQUEST_BYTES + 1) },
      });
      return (await uploadImage(request, context.dependencies)).response;
    },
  ],
  [
    "upload 429",
    async () => {
      const { context, cookie } = await signedIn(1);
      await uploadImage(await uploadRequest({ cookie }), context.dependencies);
      return (
        await uploadImage(await uploadRequest({ cookie }), context.dependencies)
      ).response;
    },
  ],
  [
    "upload 201",
    async () => {
      const { context, cookie } = await signedIn();
      return (
        await uploadImage(await uploadRequest({ cookie }), context.dependencies)
      ).response;
    },
  ],
  [
    "upload 500 with the token in the upstream error",
    async () => {
      const { context, cookie } = await signedIn();
      vi.spyOn(context.dependencies.images, "upload").mockRejectedValue(
        new Error(`Authorization: Bearer ${TEST_TOKEN}`),
      );
      return (
        await uploadImage(await uploadRequest({ cookie }), context.dependencies)
      ).response;
    },
  ],
  [
    "delete 403",
    async () => {
      const { context, cookie } = await signedIn();
      const owner = await context.signIn();
      const image = await seedImage(context, owner.session);
      return (
        await deleteImage(
          deleteRequest(image.id, cookie),
          image.id,
          context.dependencies,
        )
      ).response;
    },
  ],
  [
    "delete 404",
    async () => {
      const { context, cookie } = await signedIn();
      return (
        await deleteImage(
          deleteRequest("assetlake-image-missing", cookie),
          "assetlake-image-missing",
          context.dependencies,
        )
      ).response;
    },
  ],
  [
    "delete 204",
    async () => {
      const { context, cookie, session } = await signedIn();
      const image = await seedImage(context, session);
      return (
        await deleteImage(
          deleteRequest(image.id, cookie),
          image.id,
          context.dependencies,
        )
      ).response;
    },
  ],
];

describe("the write token never leaves the server", () => {
  it.each(scenarios)("%s", async (_label, run) => {
    await expectNoSecret(await run());
  });
});
