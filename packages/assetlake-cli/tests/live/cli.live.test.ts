import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createPngBytes } from "@assetlake/core/testing";
import { createClient } from "@sanity/client";
import { afterAll, describe, expect, it } from "vitest";

import { statusCodeOf } from "../../src/cli-errors";
import { createSanityProbes } from "../../src/doctor/sanity-probes";
import type { CliIo } from "../../src/output";
import { run } from "../../src/run";
import { createNodeRuntime } from "../../src/runtime";
import { liveTarget } from "./live-target";

// Eval lane: the CLI end to end against a real dataset, through the same run() the bin calls. The
// starter presets are dataset-global and shared with the seeded demo, so cleanup deletes only the
// ids init reports as created.
const { projectId, dataset } = liveTarget;
const slug = `cli-${Date.now().toString(36)}`;
const environment = {
  ASSETLAKE_TOKEN: liveTarget.token,
  ASSETLAKE_PROJECT_ID: projectId,
  ASSETLAKE_DATASET: dataset,
};
const workspace = mkdtempSync(join(tmpdir(), "assetlake-cli-live-"));
const sanity = createClient({ ...liveTarget, useCdn: false });
const cleanup: string[] = [];

async function cli(...argv: string[]) {
  const written = { stdout: "", stderr: "" };
  const io: CliIo = {
    stdout: (text) => {
      written.stdout += text;
    },
    stderr: (text) => {
      written.stderr += text;
    },
  };
  const exitCode = await run(argv, environment, io, createNodeRuntime(io));
  return { exitCode, ...written, json: () => JSON.parse(written.stdout) };
}

afterAll(async () => {
  for (const id of cleanup.toReversed()) {
    await sanity.delete(id).catch(() => undefined);
  }
  rmSync(workspace, { recursive: true, force: true });
});

describe(`assetlake CLI against "${dataset}"`, () => {
  let applicationId = "";
  let imageId = "";

  it("init creates the application; a second init creates nothing", async () => {
    const first = await cli("init", "--slug", slug);
    expect(first.exitCode, first.stderr).toBe(0);
    const initialized = first.json();
    cleanup.push(...initialized.created);
    applicationId = initialized.applicationId;
    expect(initialized.created).toContain(`assetlake-application-${slug}`);

    const second = await cli("init", "--slug", slug);
    expect(second.json()).toMatchObject({ created: [] });
  });

  it("doctor passes or skips every check", async () => {
    const result = await cli("doctor", "--slug", slug);
    const report = result.json();

    expect(result.exitCode, JSON.stringify(report.checks)).toBe(0);
    for (const check of report.checks) {
      expect(["pass", "skipped"], check.name).toContain(check.status);
    }
    console.log(
      JSON.stringify({
        event: "LIVE_CLI_DOCTOR",
        dataset,
        checks: report.checks,
      }),
    );
  });

  it("upload prints the record and a preset URL the CDN serves", async () => {
    const file = join(workspace, "photo.png");
    writeFileSync(file, createPngBytes(500, 400, Date.now() % 251));

    const result = await cli(
      "upload",
      file,
      "--app",
      applicationId,
      "--preset",
      "avatar",
    );
    expect(result.exitCode, result.stderr).toBe(0);
    const image = result.json();
    imageId = image.id;
    cleanup.push(image.assetId, image.id);

    expect(image).toMatchObject({ status: "ready", mimeType: "image/png" });
    expect(image.presetUrl).toContain(
      `cdn.sanity.io/images/${projectId}/${dataset}/`,
    );
    const response = await fetch(image.presetUrl);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^image\//);
  });

  it("url builds another preset for the uploaded image", async () => {
    const result = await cli("url", imageId, "--preset", "card");

    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.json().url).toMatch(/w=640&h=360/);
  });

  // Step 0 finding 4: the docs don't say whether a dry run checks permissions. If a tokenless dry
  // run succeeded, doctor's write check would prove nothing.
  it("rejects the dry-run write probe without a token", async () => {
    const probes = createSanityProbes({ ...liveTarget, token: "" });

    const outcome = await probes.dryRunWrite().then(
      () => "accepted",
      (error: unknown) => statusCodeOf(error),
    );

    expect([401, 403]).toContain(outcome);
  });
});
