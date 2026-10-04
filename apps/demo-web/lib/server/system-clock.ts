import "server-only";

import type { Clock } from "@assetlake/core";

export const systemClock: Clock = { now: () => new Date() };
