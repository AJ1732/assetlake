import { readFile } from "node:fs/promises";

import {
  type AssetLake,
  createAssetLake,
  createJsonLogger,
} from "@assetlake/core";

import type { Probes } from "./doctor/probes";
import { createSanityProbes } from "./doctor/sanity-probes";
import type { CliTarget } from "./environment";
import type { CliIo } from "./output";

/** Everything that touches the network or the disk. Gate tests swap in in-memory versions. */
export interface CliRuntime {
  /** remoteHosts: hosts an upload-from-URL may fetch from (the CLI allows the one URL it was given). */
  createAssetLake(
    target: CliTarget,
    options?: { remoteHosts?: string[] },
  ): AssetLake;
  createProbes(target: CliTarget): Probes;
  readFile(path: string): Promise<Uint8Array>;
}

export function createNodeRuntime(io: CliIo): CliRuntime {
  // Core's structured logs are diagnostics: stderr, so stdout stays one JSON document.
  const logger = createJsonLogger((line) => io.stderr(`${line}\n`));
  return {
    createAssetLake: (target, options = {}) =>
      createAssetLake(
        {
          ...target,
          remoteUploads: { allowedHosts: options.remoteHosts ?? [] },
        },
        { logger },
      ),
    createProbes: createSanityProbes,
    readFile: async (path) => new Uint8Array(await readFile(path)),
  };
}
