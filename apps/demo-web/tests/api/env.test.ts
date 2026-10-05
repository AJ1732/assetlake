import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  stubServerEnvironment,
  TEST_PASSCODE,
  TEST_TOKEN,
} from "./support/fixtures";

// env.ts parses process.env at import, so the module is loaded only after the stub.
const loadEnvironmentModule = () => import("@/lib/server/env");

const complete = {
  SANITY_WRITE_TOKEN: TEST_TOKEN,
  ASSETLAKE_DEMO_PASSCODE: TEST_PASSCODE,
  ASSETLAKE_SESSION_SECRET: "s".repeat(32),
};

describe("server environment", () => {
  beforeAll(() => stubServerEnvironment());
  afterAll(() => vi.unstubAllEnvs());

  it("parses the stubbed process environment at import", async () => {
    const { serverEnv } = await loadEnvironmentModule();
    expect(serverEnv).toMatchObject({
      SANITY_DATASET: "test",
      ASSETLAKE_DAILY_UPLOAD_CAP: 200,
    });
  });

  it("applies defaults from the schema package", async () => {
    const { parseServerEnvironment } = await loadEnvironmentModule();
    expect(parseServerEnvironment(complete)).toEqual({
      ...complete,
      SANITY_PROJECT_ID: "oshzwvjy",
      SANITY_DATASET: "production",
      SANITY_API_VERSION: "2026-10-04",
      ASSETLAKE_DAILY_UPLOAD_CAP: 200,
      NODE_ENV: "development",
    });
  });

  it("names every missing variable without echoing any value", async () => {
    const { parseServerEnvironment } = await loadEnvironmentModule();
    let message = "";
    try {
      parseServerEnvironment({
        SANITY_WRITE_TOKEN: TEST_TOKEN,
        ASSETLAKE_SESSION_SECRET: "too-short",
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe(
      "Invalid demo-web server environment: ASSETLAKE_DEMO_PASSCODE, ASSETLAKE_SESSION_SECRET",
    );
  });

  it("targets another project when SANITY_PROJECT_ID is set", async () => {
    const { parseServerEnvironment } = await loadEnvironmentModule();
    expect(
      parseServerEnvironment({ ...complete, SANITY_PROJECT_ID: "abc123" }),
    ).toMatchObject({
      SANITY_PROJECT_ID: "abc123",
      SANITY_DATASET: "production",
    });
  });

  it("treats blank lines from .env.example as unset", async () => {
    const { parseServerEnvironment } = await loadEnvironmentModule();
    expect(
      parseServerEnvironment({
        ...complete,
        SANITY_PROJECT_ID: "",
        SANITY_DATASET: "  ",
      }),
    ).toMatchObject({
      SANITY_PROJECT_ID: "oshzwvjy",
      SANITY_DATASET: "production",
    });
  });

  it("still requires secrets that are present but blank", async () => {
    const { parseServerEnvironment } = await loadEnvironmentModule();
    expect(() =>
      parseServerEnvironment({ ...complete, SANITY_WRITE_TOKEN: " " }),
    ).toThrow("Invalid demo-web server environment: SANITY_WRITE_TOKEN");
  });

  it.each([
    ["SANITY_PROJECT_ID", "Not An Id"],
    ["SANITY_DATASET", "Prod.Data"],
  ])("rejects %s=%j by name", async (name, value) => {
    const { parseServerEnvironment } = await loadEnvironmentModule();
    expect(() =>
      parseServerEnvironment({ ...complete, [name]: value }),
    ).toThrow(`Invalid demo-web server environment: ${name}`);
  });

  it.each(["0", "-5", "1.5", "lots"])("rejects daily cap %j", async (cap) => {
    const { parseServerEnvironment } = await loadEnvironmentModule();
    expect(() =>
      parseServerEnvironment({ ...complete, ASSETLAKE_DAILY_UPLOAD_CAP: cap }),
    ).toThrow(/ASSETLAKE_DAILY_UPLOAD_CAP/);
  });
});
