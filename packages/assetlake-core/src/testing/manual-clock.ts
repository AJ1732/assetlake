import type { Clock } from "../clock";

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
