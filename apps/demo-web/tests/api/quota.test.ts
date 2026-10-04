import { createManualClock } from "@assetlake/core/testing";
import { describe, expect, it } from "vitest";

import {
  createQuotaCounters,
  createUploadQuota,
  PER_SESSION_UPLOAD_LIMIT,
  startOfUtcDay,
} from "@/lib/server/quota";

import {
  APPLICATION_ID,
  createTestContext,
  seedImage,
  type TestContext,
} from "./support/fixtures";

const user = (id: string) => ({ type: "user", id: `user-demo-${id}` });

function quotaFor(
  context: TestContext,
  { dailyCap = 200, clock = context.clock } = {},
) {
  return createUploadQuota({
    images: context.assetLake.images,
    applicationId: APPLICATION_ID,
    dailyCap,
    clock,
    counters: createQuotaCounters(),
  });
}

async function reserveTimes(
  quota: ReturnType<typeof quotaFor>,
  entity: { type: string; id: string },
  times: number,
) {
  const reservations = [];
  for (let index = 0; index < times; index += 1)
    reservations.push(await quota.reserve(entity));
  return reservations;
}

describe("per-session quota", () => {
  it("allows five reservations then refuses the sixth", async () => {
    const quota = quotaFor(createTestContext());
    const reservations = await reserveTimes(
      quota,
      user("aaaaaaaa"),
      PER_SESSION_UPLOAD_LIMIT,
    );
    expect(reservations.every(Boolean)).toBe(true);
    await expect(quota.reserve(user("aaaaaaaa"))).resolves.toBeNull();
    await expect(quota.reserve(user("bbbbbbbb"))).resolves.not.toBeNull();
  });

  it("counts records already in Sanity (survives a restart)", async () => {
    const context = createTestContext();
    const { session } = await context.signIn();
    for (let seed = 1; seed <= PER_SESSION_UPLOAD_LIMIT; seed += 1)
      await seedImage(context, session, seed);

    const freshProcess = quotaFor(context);
    await expect(
      freshProcess.reserve({ type: "user", id: session.userId }),
    ).resolves.toBeNull();
  });

  it("keeps counting after the user deletes their uploads", async () => {
    const context = createTestContext();
    const quota = quotaFor(context);
    const { session } = await context.signIn();
    const entity = { type: "user", id: session.userId };

    for (let seed = 1; seed <= PER_SESSION_UPLOAD_LIMIT; seed += 1) {
      expect(await quota.reserve(entity)).not.toBeNull();
      const image = await seedImage(context, session, seed);
      await context.assetLake.images.delete({
        id: image.id,
        actorEntity: entity,
      });
    }

    expect(context.store.images.size).toBe(0);
    await expect(quota.reserve(entity)).resolves.toBeNull();
  });

  it("frees a slot on release, once", async () => {
    const quota = quotaFor(createTestContext());
    const entity = user("aaaaaaaa");
    const [first] = await reserveTimes(quota, entity, PER_SESSION_UPLOAD_LIMIT);

    first?.release();
    first?.release();

    await expect(quota.reserve(entity)).resolves.not.toBeNull();
    await expect(quota.reserve(entity)).resolves.toBeNull();
  });

  it("does not let parallel requests share the last slot", async () => {
    const quota = quotaFor(createTestContext());
    const entity = user("aaaaaaaa");
    await reserveTimes(quota, entity, PER_SESSION_UPLOAD_LIMIT - 1);

    const racing = await Promise.all([
      quota.reserve(entity),
      quota.reserve(entity),
      quota.reserve(entity),
    ]);
    expect(racing.filter(Boolean)).toHaveLength(1);
  });
});

describe("global daily cap", () => {
  it("counts across sessions", async () => {
    const quota = quotaFor(createTestContext(), { dailyCap: 3 });
    for (const id of ["aaaaaaaa", "bbbbbbbb", "cccccccc"])
      expect(await quota.reserve(user(id))).not.toBeNull();
    await expect(quota.reserve(user("dddddddd"))).resolves.toBeNull();
  });

  it("counts uploads already in Sanity today", async () => {
    const context = createTestContext();
    const first = await context.signIn();
    const second = await context.signIn();
    await seedImage(context, first.session, 1);
    await seedImage(context, second.session, 2);

    const quota = quotaFor(context, { dailyCap: 2 });
    await expect(quota.reserve(user("cccccccc"))).resolves.toBeNull();
  });

  it("is not reset by upload-then-delete loops across fresh sessions", async () => {
    const context = createTestContext();
    const quota = quotaFor(context, { dailyCap: 2 });

    for (let seed = 1; seed <= 2; seed += 1) {
      const { session } = await context.signIn();
      const entity = { type: "user", id: session.userId };
      expect(await quota.reserve(entity)).not.toBeNull();
      const image = await seedImage(context, session, seed);
      await context.assetLake.images.delete({
        id: image.id,
        actorEntity: entity,
      });
    }

    await expect(quota.reserve(user("cccccccc"))).resolves.toBeNull();
  });

  it("rolls over at midnight UTC", async () => {
    const clock = createManualClock(new Date("2026-10-04T23:59:59.000Z"));
    const quota = quotaFor(createTestContext(), { dailyCap: 1, clock });

    expect(await quota.reserve(user("aaaaaaaa"))).not.toBeNull();
    await expect(quota.reserve(user("bbbbbbbb"))).resolves.toBeNull();

    clock.advance(2000);
    await expect(quota.reserve(user("bbbbbbbb"))).resolves.not.toBeNull();
  });

  it("computes the start of day in UTC regardless of the input offset", () => {
    expect(
      startOfUtcDay(new Date("2026-10-04T23:30:00.000-07:00")).toISOString(),
    ).toBe("2026-10-05T00:00:00.000Z");
  });
});
