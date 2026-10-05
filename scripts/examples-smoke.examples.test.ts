import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { createAssetLake } from "@assetlake/core";
import { createPngBytes } from "@assetlake/core/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  exec,
  isolatedEnvironment,
  packWorkspacePackage,
  ROOT,
} from "./support/pack-workspace";

// Example lane: each example runs as a user would run it (a fresh npm install, its own scripts),
// with the freshly packed core tarball in place of the npm range, against the `test` dataset.
// URL uploads fetch a cdn.sanity.io URL of the image just uploaded (B11 spike S1).
const run = Date.now().toString(36);
const LOCAL_USER = `example-${run}`;
const target = {
  projectId: process.env.SANITY_PROJECT_ID ?? "oshzwvjy",
  dataset: process.env.SANITY_TEST_DATASET ?? "test",
  apiVersion: "2026-10-04",
  token: process.env.SANITY_WRITE_TOKEN ?? "",
};

let work = "";
let coreTarball = "";
const created: string[] = [];

const exampleEnvironment = (port: number) =>
  isolatedEnvironment({
    SANITY_PROJECT_ID: target.projectId,
    SANITY_DATASET: target.dataset,
    SANITY_WRITE_TOKEN: target.token,
    ASSETLAKE_APPLICATION_ID: "assetlake-application-campus-demo",
    ASSETLAKE_REMOTE_HOSTS: "cdn.sanity.io",
    EXAMPLE_LOCAL_USER: LOCAL_USER,
    PORT: String(port),
    NEXT_TELEMETRY_DISABLED: "1",
  });

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), "assetlake-examples-"));
  coreTarball = packWorkspacePackage("packages/assetlake-core", work);
});

// Safety net for a failed run: delete what the examples created, as the owner they used.
afterAll(async () => {
  const assetLake = createAssetLake(target);
  for (const id of created) {
    await assetLake.images
      .delete({ id, actorEntity: { type: "user", id: LOCAL_USER } })
      .catch(() => undefined);
  }
  if (work) rmSync(work, { recursive: true, force: true });
});

function prepareExample(name: string): string {
  const directory = path.join(work, name);
  cpSync(path.join(ROOT, "examples", name), directory, {
    recursive: true,
    filter: (source) =>
      !["node_modules", ".next", ".env", ".env.local"].includes(
        path.basename(source),
      ),
  });
  exec(
    "npm",
    ["install", "--no-audit", "--no-fund", "--loglevel=error", coreTarball],
    directory,
  );
  return directory;
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

interface RunningServer {
  url: string;
  stop(): void;
}

async function startServer(
  command: string,
  commandArguments: string[],
  cwd: string,
  port: number,
): Promise<RunningServer> {
  const child = spawn(command, commandArguments, {
    cwd,
    env: exampleEnvironment(port),
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  const url = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`server exited:\n${output}`);
    const ready = await fetch(url).then(
      () => true,
      () => false,
    );
    if (ready) return { url, stop: () => child.kill() };
    await sleep(500);
  }
  child.kill();
  throw new Error(`server did not start within 60s:\n${output}`);
}

async function readJson(response: Response) {
  const body = await response.json();
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function expectCdnImage(url: string) {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toMatch(/^image\//);
}

// A fresh copy per upload: Uint8Array<ArrayBuffer> is what fetch and Blob accept.
const png = () => new Uint8Array(createPngBytes(320, 240, Date.now() % 251));

describe("examples/express", () => {
  let server: RunningServer | undefined;

  beforeAll(async () => {
    const directory = prepareExample("express");
    exec("npx", ["tsc", "--noEmit"], directory);
    server = await startServer(
      "node",
      ["src/server.ts"],
      directory,
      await freePort(),
    );
  });
  afterAll(() => server?.stop());

  it("uploads bytes, serves a preset, uploads from a URL and deletes both", async () => {
    const base = server!.url;
    const image = await readJson(
      await fetch(`${base}/images`, {
        method: "POST",
        headers: { "content-type": "image/png", "x-filename": "photo.png" },
        body: png(),
      }),
    );
    created.push(image.id);

    const { url } = await readJson(
      await fetch(`${base}/images/${image.id}/url?preset=card`),
    );
    await expectCdnImage(url);

    const remote = await readJson(
      await fetch(`${base}/images/from-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: `${image.url}?w=160` }),
      }),
    );
    created.push(remote.id);
    expect(remote).toMatchObject({ status: "ready", width: 160 });

    for (const id of [remote.id, image.id]) {
      const response = await fetch(`${base}/images/${id}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(204);
    }
  });

  it("refuses a URL whose host is not allowed", async () => {
    const response = await fetch(`${server!.url}/images/from-url`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/photo.png" }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("SOURCE_URL_NOT_ALLOWED");
  });
});

describe("examples/nextjs", () => {
  let server: RunningServer | undefined;

  beforeAll(async () => {
    const directory = prepareExample("nextjs");
    const port = await freePort();
    // Next's own bin, not npx: killing an npx wrapper can orphan the server it started.
    const next = path.join(
      directory,
      "node_modules",
      "next",
      "dist",
      "bin",
      "next",
    );
    exec("node", [next, "build"], directory, exampleEnvironment(port));
    server = await startServer(
      "node",
      [next, "start", "-p", String(port)],
      directory,
      port,
    );
  });
  afterAll(() => server?.stop());

  it("renders the page", async () => {
    const response = await fetch(server!.url);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("AssetLake + Next.js");
  });

  it("uploads a multipart file, uploads from a URL and deletes both", async () => {
    const base = server!.url;
    const form = new FormData();
    form.append("file", new Blob([png()], { type: "image/png" }), "photo.png");
    const image = await readJson(
      await fetch(`${base}/api/images`, { method: "POST", body: form }),
    );
    created.push(image.id);
    expect(image).toMatchObject({ status: "ready", width: 320 });

    const remote = await readJson(
      await fetch(`${base}/api/images/from-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: `${image.url}?w=160` }),
      }),
    );
    created.push(remote.id);
    await expectCdnImage(remote.url);

    for (const id of [remote.id, image.id]) {
      const response = await fetch(`${base}/api/images/${id}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(204);
    }
  });
});
