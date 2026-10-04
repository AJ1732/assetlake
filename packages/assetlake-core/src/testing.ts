// Test doubles for consumers (demo-web, console) and core's own gate tests. Node-only.
import type { Clock } from "./images/upload-image";

export { silentLogger } from "./logging/logger";
export {
  createPngBytes,
  readPngDimensions,
  signatureBytes,
} from "./testing/image-fixtures";
export type { InMemoryStoreSeed } from "./testing/in-memory-store";
export { InMemoryStore } from "./testing/in-memory-store";

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
