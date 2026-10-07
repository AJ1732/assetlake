import type { AssetLakeConfigInput } from "../client/config";
import { createAssetLake } from "../create-asset-lake";
import type { LogEvent, Logger, LogLevel } from "../logging/logger";
import type { PolicyRecord, PresetRecord } from "../store/asset-lake-store";
import { InMemoryStore } from "./in-memory-store";
import { createManualClock } from "./manual-clock";

export const TEST_TOKEN = "sk-test-write-token-must-never-leak";
export const APPLICATION_ID = "assetlake-application-campus-demo";
export const POLICY_ID = "assetlake-policy-public-profile-images";

export const basePolicy: PolicyRecord = {
  id: POLICY_ID,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFileSizeBytes: 5 * 1024 * 1024,
  minWidth: null,
  minHeight: null,
  maxWidth: null,
  maxHeight: null,
  requiresReview: false,
};

export const avatarPreset: PresetRecord = {
  slug: "avatar",
  name: "Avatar",
  width: 256,
  height: 256,
  fit: "crop",
  crop: null,
  quality: 82,
  autoFormat: true,
};

export function createRecordingLogger() {
  const entries: Array<{
    level: LogLevel;
    event: LogEvent;
    fields: Record<string, unknown>;
  }> = [];
  const logger: Logger = {
    log: (level, event, fields = {}) => entries.push({ level, event, fields }),
  };
  return { logger, entries, events: () => entries.map((entry) => entry.event) };
}

/** Core wired to the in-memory store with the seeded demo application, policy and avatar preset. */
export interface ScenarioOptions {
  policy?: Partial<PolicyRecord>;
  presets?: PresetRecord[];
  config?: Partial<AssetLakeConfigInput>;
}

export function createScenario({
  policy = {},
  presets = [avatarPreset],
  config = {},
}: ScenarioOptions = {}) {
  const store = new InMemoryStore({
    applications: [
      { id: APPLICATION_ID, slug: "campus-demo", defaultPolicyId: POLICY_ID },
    ],
    policies: [{ ...basePolicy, ...policy }],
    presets,
  });
  const recording = createRecordingLogger();
  const clock = createManualClock();
  let counter = 0;
  const assetLake = createAssetLake(
    {
      projectId: "testproject",
      dataset: "test",
      apiVersion: "2026-10-04",
      token: TEST_TOKEN,
      ...config,
    },
    {
      store,
      logger: recording.logger,
      clock,
      ids: { randomId: () => `id-${(counter += 1)}` },
    },
  );
  return { store, assetLake, clock, ...recording };
}
