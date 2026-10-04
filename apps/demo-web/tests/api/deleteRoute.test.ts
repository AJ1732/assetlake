import { describe, expect, it, vi } from "vitest";

import { deleteImage } from "@/lib/server/http/deleteImageHandler";
import { GENERIC_SERVER_MESSAGE } from "@/lib/server/httpErrors";

import {
  createTestContext,
  deleteRequest,
  expectFailure,
  seedImage,
} from "./support/fixtures";

describe("DELETE /api/assets/images/[id]", () => {
  it("returns 401 without a session and keeps the record", async () => {
    const context = createTestContext();
    const { session } = await context.signIn();
    const image = await seedImage(context, session);

    const { response } = await deleteImage(
      deleteRequest(image.id),
      image.id,
      context.dependencies,
    );

    await expectFailure(response, 401, "UNAUTHENTICATED");
    expect(context.store.images.has(image.id)).toBe(true);
  });

  it("returns 403 when deleting another user's image", async () => {
    const context = createTestContext();
    const owner = await context.signIn();
    const intruder = await context.signIn();
    const image = await seedImage(context, owner.session);

    const { response, actorId } = await deleteImage(
      deleteRequest(image.id, intruder.cookie),
      image.id,
      context.dependencies,
    );

    await expectFailure(response, 403, "FORBIDDEN");
    expect(actorId).toBe(intruder.session.userId);
    expect(context.store.images.has(image.id)).toBe(true);
  });

  it("returns 404 for an unknown id", async () => {
    const context = createTestContext();
    const { cookie } = await context.signIn();
    const id = "assetlake-image-missing";
    const { response } = await deleteImage(
      deleteRequest(id, cookie),
      id,
      context.dependencies,
    );
    await expectFailure(response, 404, "IMAGE_NOT_FOUND");
  });

  it.each(["drafts.assetlake-image-1", "a/b", "", "x".repeat(129)])(
    "returns 400 for malformed id %j without calling core",
    async (id) => {
      const context = createTestContext();
      const remove = vi.spyOn(context.dependencies.images, "delete");
      const { cookie } = await context.signIn();
      const { response } = await deleteImage(
        deleteRequest("x", cookie),
        id,
        context.dependencies,
      );
      await expectFailure(response, 400, "BAD_REQUEST");
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it("returns 204 with no body and removes the owner's image", async () => {
    const context = createTestContext();
    const { session, cookie } = await context.signIn();
    const image = await seedImage(context, session);

    const { response } = await deleteImage(
      deleteRequest(image.id, cookie),
      image.id,
      context.dependencies,
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(context.store.images.has(image.id)).toBe(false);
  });

  it("returns a generic 500 when core fails unexpectedly", async () => {
    const context = createTestContext();
    vi.spyOn(context.dependencies.images, "delete").mockRejectedValue(
      new Error("socket hang up"),
    );
    const { cookie } = await context.signIn();
    const { response, error } = await deleteImage(
      deleteRequest("assetlake-image-1", cookie),
      "assetlake-image-1",
      context.dependencies,
    );
    const failure = await expectFailure(response, 500, "UPLOAD_FAILED");
    expect(failure.message).toBe(GENERIC_SERVER_MESSAGE);
    expect(error).toBeInstanceOf(Error);
  });
});
