// Test doubles for consumers (demo-web, console) and core's own gate tests. Node-only.
export { silentLogger } from "./logging/logger";
export type {
  ApplicationRecord,
  PolicyRecord,
  PresetRecord,
} from "./store/asset-lake-store";
export {
  createPngBytes,
  readPngDimensions,
  signatureBytes,
} from "./testing/image-fixtures";
export type { InMemoryStoreSeed } from "./testing/in-memory-store";
export { InMemoryStore } from "./testing/in-memory-store";
export { createManualClock } from "./testing/manual-clock";
