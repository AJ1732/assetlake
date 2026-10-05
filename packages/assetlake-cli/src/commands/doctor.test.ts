import { createSetupPlan } from "@assetlake/core";
import { describe, expect, it } from "vitest";

import type { Probes } from "../doctor/probes";
import { createTestLake } from "../test-support";
import { doctor, type DoctorCheck } from "./doctor";

const httpError = (statusCode: number, message = `HTTP ${statusCode}`) =>
  Object.assign(new Error(message), { statusCode });

function fakeProbes(overrides: Partial<Probes> = {}): Probes {
  return {
    countDocuments: async () => 12,
    countDocumentsWithoutToken: async () => 10,
    dryRunWrite: async () => {},
    corsOrigins: async () => ["https://app.example.com"],
    ...overrides,
  };
}

const options = { slug: "my-app", projectId: "testproject", dataset: "test" };
const plan = createSetupPlan({ applicationSlug: "my-app" });

async function runDoctor(probes: Probes, { setUp = true } = {}) {
  const { assetLake } = createTestLake();
  if (setUp) await assetLake.setup.ensure(plan);
  const result = await doctor({ assetLake, probes }, options);
  const output = result.output as { ok: boolean; checks: DoctorCheck[] };
  const check = (name: string) =>
    output.checks.find((candidate) => candidate.name === name);
  return { result, output, check };
}

describe("doctor", () => {
  it("passes every check for an Editor token on a set-up public dataset", async () => {
    const { result, output } = await runDoctor(fakeProbes());

    expect(result.exitCode).toBe(0);
    expect(output).toMatchObject({
      ok: true,
      projectId: "testproject",
      dataset: "test",
    });
    expect(output.checks.map(({ name, status }) => [name, status])).toEqual([
      ["token", "pass"],
      ["write", "pass"],
      ["dataset-visibility", "pass"],
      ["setup", "pass"],
      ["cors", "pass"],
    ]);
  });

  it("fails the token check and skips the rest when the token is rejected", async () => {
    const { result, output } = await runDoctor(
      fakeProbes({ countDocuments: () => Promise.reject(httpError(401)) }),
    );

    expect(result.exitCode).toBe(1);
    expect(output.checks.map(({ status }) => status)).toEqual([
      "fail",
      "skipped",
      "skipped",
      "skipped",
      "skipped",
    ]);
  });

  it("fails the write check for a token without the Editor role", async () => {
    const { result, check } = await runDoctor(
      fakeProbes({ dryRunWrite: () => Promise.reject(httpError(403)) }),
    );

    expect(result.exitCode).toBe(1);
    expect(check("write")).toMatchObject({ status: "fail" });
    expect(check("write")?.detail).toContain("Editor");
  });

  it("reports a private dataset without failing", async () => {
    const { result, check } = await runDoctor(
      fakeProbes({ countDocumentsWithoutToken: async () => 0 }),
    );

    expect(result.exitCode).toBe(0);
    expect(check("dataset-visibility")?.detail).toMatch(/^Private/);
  });

  it("reports a public dataset", async () => {
    const { check } = await runDoctor(fakeProbes());

    expect(check("dataset-visibility")?.detail).toMatch(/^Public/);
  });

  it("skips the visibility comparison on an empty dataset", async () => {
    const { check } = await runDoctor(
      fakeProbes({
        countDocuments: async () => 0,
        countDocumentsWithoutToken: async () => 0,
      }),
    );

    expect(check("dataset-visibility")).toMatchObject({ status: "skipped" });
  });

  it("fails setup, naming the missing ids and the command that creates them", async () => {
    const { result, check } = await runDoctor(fakeProbes(), { setUp: false });

    expect(result.exitCode).toBe(1);
    expect(check("setup")).toMatchObject({ status: "fail" });
    expect(check("setup")?.detail).toContain("assetlake-application-my-app");
    expect(check("setup")?.detail).toContain("assetlake init --slug my-app");
  });

  it("skips CORS when the token cannot read project settings", async () => {
    const { result, check } = await runDoctor(
      fakeProbes({ corsOrigins: () => Promise.reject(httpError(403)) }),
    );

    expect(result.exitCode).toBe(0);
    expect(check("cors")).toMatchObject({ status: "skipped" });
  });

  it("fails a check on an unexpected error and shows its status and message", async () => {
    const { result, check } = await runDoctor(
      fakeProbes({
        corsOrigins: () => Promise.reject(httpError(500, "upstream broke")),
      }),
    );

    expect(result.exitCode).toBe(1);
    expect(check("cors")).toEqual({
      name: "cors",
      status: "fail",
      detail: "HTTP 500: upstream broke",
    });
  });
});
