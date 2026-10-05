import { createRailwayContext, project, type ServiceNode } from "railway/iac";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import railwayProgram from "../../../../.railway/railway";
import { stubServerEnvironment } from "./support/fixtures";

// `railway config apply` makes Railway match this spec: a wrong branch moves the deploy trigger,
// and a variable missing from `env` is deleted from the service.
async function loadDemoWebService(): Promise<ServiceNode | undefined> {
  const spec = await railwayProgram(createRailwayContext(), project);
  return (spec.resources ?? [])
    .flat()
    .find(
      (resource): resource is ServiceNode =>
        resource.type === "service" && resource.name === "demo-web",
    );
}

describe("Railway spec for demo-web", () => {
  let demoWeb: ServiceNode | undefined;

  beforeAll(async () => {
    stubServerEnvironment();
    demoWeb = await loadDemoWebService();
  });
  afterAll(() => vi.unstubAllEnvs());

  it("deploys from main", () => {
    expect(demoWeb?.source).toMatchObject({
      type: "github",
      repo: "AJ1732/assetlake",
      branch: "main",
    });
  });

  it("declares every variable the server environment reads", async () => {
    const { SERVER_ENVIRONMENT_VARIABLES } = await import("@/lib/server/env");
    // NODE_ENV is left to `next start`, which sets production.
    const required = SERVER_ENVIRONMENT_VARIABLES.filter(
      (name) => name !== "NODE_ENV",
    );

    expect(Object.keys(demoWeb?.variables ?? {}).sort()).toEqual(
      required.sort(),
    );
  });

  it("pins the public project id as a literal and keeps the token out of the file", () => {
    expect(demoWeb?.variables).toMatchObject({
      SANITY_PROJECT_ID: { type: "literal", value: "oshzwvjy" },
      SANITY_WRITE_TOKEN: { type: "preserve" },
    });
  });
});
