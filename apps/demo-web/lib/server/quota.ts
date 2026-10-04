import "server-only";

import type { AssetLake, Clock } from "@assetlake/core";
import type { EntityRef } from "@assetlake/core/contracts";

export const PER_SESSION_UPLOAD_LIMIT = 5;

export interface QuotaCounters {
  perEntity: Map<string, number>;
  day: { key: string; count: number };
}

export interface UploadReservation {
  release(): void;
}

export type UploadQuota = ReturnType<typeof createUploadQuota>;

type QuotaReader = Pick<
  AssetLake["images"],
  "countUploadsForEntity" | "countUploadsSince"
>;

export const createQuotaCounters = (): QuotaCounters => ({
  perEntity: new Map(),
  day: { key: "", count: 0 },
});

const SHARED_COUNTERS = Symbol.for("assetlake.uploadQuota");

// On globalThis so dev HMR reloads and separately bundled routes share one set of counters.
export function sharedQuotaCounters(): QuotaCounters {
  const holder = globalThis as typeof globalThis & {
    [SHARED_COUNTERS]?: QuotaCounters;
  };
  holder[SHARED_COUNTERS] ??= createQuotaCounters();
  return holder[SHARED_COUNTERS];
}

export const startOfUtcDay = (instant: Date): Date =>
  new Date(
    Date.UTC(
      instant.getUTCFullYear(),
      instant.getUTCMonth(),
      instant.getUTCDate(),
    ),
  );

const entityKey = (entity: EntityRef) => `${entity.type}:${entity.id}`;

/**
 * Each limit uses max(Sanity count, in-process count). Sanity survives restarts; the in-process
 * floor survives deletes, so upload-then-delete loops (across fresh sessions too) cannot reset
 * it. Slots are taken synchronously after the counts resolve, so parallel requests cannot both
 * claim the last one. The floor is per process and resets on restart (one replica in P0).
 */
export function createUploadQuota({
  images,
  applicationId,
  dailyCap,
  clock,
  counters = sharedQuotaCounters(),
}: {
  images: QuotaReader;
  applicationId: string;
  dailyCap: number;
  clock: Clock;
  counters?: QuotaCounters;
}) {
  function currentDay() {
    const key = clock.now().toISOString().slice(0, 10);
    if (counters.day.key !== key) counters.day = { key, count: 0 };
    return counters.day;
  }

  return {
    async reserve(entity: EntityRef): Promise<UploadReservation | null> {
      const [entityCount, dailyCount] = await Promise.all([
        images.countUploadsForEntity(entity),
        images.countUploadsSince({
          applicationId,
          since: startOfUtcDay(clock.now()),
        }),
      ]);

      const key = entityKey(entity);
      const day = currentDay();
      const entityUsed = Math.max(
        entityCount,
        counters.perEntity.get(key) ?? 0,
      );
      const dailyUsed = Math.max(dailyCount, day.count);
      if (entityUsed >= PER_SESSION_UPLOAD_LIMIT || dailyUsed >= dailyCap)
        return null;

      counters.perEntity.set(key, entityUsed + 1);
      day.count = dailyUsed + 1;

      let released = false;
      return {
        release() {
          if (released) return;
          released = true;
          counters.perEntity.set(
            key,
            Math.max(0, (counters.perEntity.get(key) ?? 1) - 1),
          );
          if (counters.day === day) day.count = Math.max(0, day.count - 1);
        },
      };
    },
  };
}
