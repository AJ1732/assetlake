// Test doubles for consumers (demo-web, console) and core's own gate tests. Node-only.
import type { Clock } from "./images/uploadImage";

export { silentLogger } from "./logging/logger";
export {
  createPngBytes,
  readPngDimensions,
  signatureBytes,
} from "./testing/imageFixtures";
export type { InMemoryStoreSeed } from "./testing/inMemoryStore";
export { InMemoryStore } from "./testing/inMemoryStore";

export function createManualClock(
  start = new Date("2026-10-04T12:00:00.000Z"),
): Clock & { advance(milliseconds: number): void } {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance: (milliseconds) => {
      current += milliseconds;
    },
  };
}
