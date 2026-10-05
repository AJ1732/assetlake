import { createPngBytes, InMemoryStore } from "@assetlake/core/testing";
import { describe, expect, it } from "vitest";

import type { Probes } from "./doctor/probes";
import type { CliTarget } from "./environment";
import { run } from "./run";
import type { CliRuntime } from "./runtime";
import { createRecordingIo, createTestLake, TEST_TOKEN } from "./test-support";

const ENVIRONMENT = {
  ASSETLAKE_TOKEN: TEST_TOKEN,
  ASSETLAKE_PROJECT_ID: "testproject",
  ASSETLAKE_DATASET: "test",
};

const healthyProbes: Probes = {
  countDocuments: async () => 6,
  countDocumentsWithoutToken: async () => 6,
  dryRunWrite: async () => {},
  corsOrigins: async () => [],
};

function createHarness(
  files: Record<string, Uint8Array> = {},
  probes: Probes = healthyProbes,
) {
  const store = new InMemoryStore();
  const targets: CliTarget[] = [];
  const remoteHosts: string[][] = [];
  const runtime: CliRuntime = {
    createAssetLake: (target, options) => {
      targets.push(target);
      remoteHosts.push(options?.remoteHosts ?? []);
      return createTestLake(store, options?.remoteHosts).assetLake;
    },
    createProbes: () => probes,
    readFile: async (path) => {
      const bytes = files[path];
      if (!bytes) throw new Error(`ENOENT: no such file, open '${path}'`);
      return bytes;
    },
  };
  const invoke = async (
    argv: string[],
    environment: Record<string, string | undefined> = ENVIRONMENT,
  ) => {
    const { io, written } = createRecordingIo();
    const exitCode = await run(argv, environment, io, runtime);
    return { exitCode, ...written };
  };
  return { store, targets, remoteHosts, invoke };
}

describe("run", () => {
  it("prints usage and exits 0 for --help", async () => {
    const { invoke } = createHarness();

    const result = await invoke(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: assetlake <command>");
  });

  it("exits 2 with usage on stderr when no command is given", async () => {
    const { invoke } = createHarness();

    const result = await invoke([]);

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Usage: assetlake <command>");
  });

  it.each([["--token", "sk-typed-in-a-flag"], ["--token=sk-typed-in-a-flag"]])(
    "refuses a token flag (%s) without echoing its value",
    async (...argv) => {
      const { invoke, targets } = createHarness();

      const result = await invoke(["init", ...argv]);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("ASSETLAKE_TOKEN");
      expect(result.stderr).not.toContain("sk-typed-in-a-flag");
      expect(targets).toEqual([]);
    },
  );

  it.each([
    ["an unknown command", ["deploy"]],
    ["an unknown option", ["init", "--colour"]],
    ["a missing positional", ["upload", "--app", "x"]],
    ["an extra positional", ["init", "extra"]],
    ["a missing required option", ["url", "assetlake-image-1"]],
  ])("exits 2 for %s", async (_label, argv) => {
    const { invoke } = createHarness();

    const result = await invoke(argv);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Run "assetlake --help"');
  });

  it("exits 2 naming the variables when no token is configured", async () => {
    const { invoke } = createHarness();

    const result = await invoke(["init"], { ASSETLAKE_PROJECT_ID: "p1" });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("ASSETLAKE_TOKEN");
  });

  it("runs init then upload against the same project and prints one JSON document each", async () => {
    const { invoke, targets } = createHarness({
      "photo.png": createPngBytes(320, 240),
    });

    const initialized = await invoke(["init", "--slug", "shop"]);
    expect(initialized.exitCode).toBe(0);
    expect(JSON.parse(initialized.stdout)).toMatchObject({
      event: "INIT_COMPLETED",
      applicationId: "assetlake-application-shop",
    });

    const uploaded = await invoke([
      "upload",
      "photo.png",
      "--app",
      "assetlake-application-shop",
      "--preset",
      "avatar",
      "--tag",
      "a",
      "--tag",
      "b",
    ]);
    expect(uploaded.exitCode).toBe(0);
    expect(JSON.parse(uploaded.stdout)).toMatchObject({
      status: "ready",
      preset: "avatar",
    });
    expect(targets.map((target) => target.projectId)).toEqual([
      "testproject",
      "testproject",
    ]);
  });

  it("uploads from a URL allowing only that URL's host, then deletes it", async () => {
    const { invoke, store, remoteHosts } = createHarness();
    await invoke(["init"]);
    const source = "https://uploads.example.com/a.png";
    store.serveRemote(source, createPngBytes(40, 30));

    const uploaded = await invoke([
      "upload",
      source,
      "--app",
      "assetlake-application-my-app",
    ]);
    expect(uploaded.exitCode, uploaded.stderr).toBe(0);
    expect(remoteHosts.at(-1)).toEqual(["uploads.example.com"]);

    const { id } = JSON.parse(uploaded.stdout) as { id: string };
    const deleted = await invoke(["delete", id]);
    expect(JSON.parse(deleted.stdout)).toEqual({
      event: "IMAGE_DELETED",
      imageId: id,
    });
    expect(store.images.size).toBe(0);
  });

  it("lets --project and --dataset override the environment", async () => {
    const { invoke, targets } = createHarness();

    await invoke(["init", "--project", "other", "--dataset", "staging"]);

    expect(targets[0]).toMatchObject({
      projectId: "other",
      dataset: "staging",
    });
  });

  it("exits 1 with the error code when core rejects the request", async () => {
    const { invoke } = createHarness();

    const result = await invoke(["url", "assetlake-image-1", "--preset", "x"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/assetlake: (IMAGE|PRESET)_NOT_FOUND: /);
  });

  it("exits 1 when a file cannot be read", async () => {
    const { invoke } = createHarness();

    const result = await invoke(["upload", "missing.png", "--app", "x"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("ENOENT");
  });

  it("exits 1 from doctor when a check fails", async () => {
    const { invoke } = createHarness();

    const result = await invoke(["doctor"]);

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false });
  });

  it("scrubs the token from doctor's stdout when an upstream error echoes it", async () => {
    const echoing = Object.assign(new Error(`bad token ${TEST_TOKEN}`), {
      statusCode: 500,
    });
    const { invoke } = createHarness(
      {},
      { ...healthyProbes, corsOrigins: () => Promise.reject(echoing) },
    );

    const result = await invoke(["doctor"]);

    expect(result.stdout).toContain("[redacted]");
    expect(result.stdout).not.toContain(TEST_TOKEN);
  });

  it("scrubs the token from an upstream error message", async () => {
    const { invoke } = createHarness({ "photo.png": createPngBytes(10, 10) });

    // core echoes the unknown application id, so a token pasted into --app comes back in the error.
    const result = await invoke(["upload", "photo.png", "--app", TEST_TOKEN]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).not.toContain(TEST_TOKEN);
    expect(result.stderr).toContain("[redacted]");
  });
});
