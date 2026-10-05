// Gate-test wiring: real core over the in-memory store, so commands run end to end without network.
import { createAssetLake } from "@assetlake/core";
import { InMemoryStore, silentLogger } from "@assetlake/core/testing";

import type { CliTarget } from "./environment";
import type { CliIo } from "./output";

export const TEST_TOKEN = "sk-cli-test-token-must-never-leak";

export const TEST_TARGET: CliTarget = {
  projectId: "testproject",
  dataset: "test",
  apiVersion: "2026-10-04",
  token: TEST_TOKEN,
};

export function createTestLake(
  store = new InMemoryStore(),
  remoteHosts: string[] = [],
) {
  const assetLake = createAssetLake(
    { ...TEST_TARGET, remoteUploads: { allowedHosts: remoteHosts } },
    { store, logger: silentLogger },
  );
  return { store, assetLake };
}

export function createRecordingIo() {
  const written = { stdout: "", stderr: "" };
  const io: CliIo = {
    stdout: (text) => {
      written.stdout += text;
    },
    stderr: (text) => {
      written.stderr += text;
    },
  };
  return { io, written };
}
