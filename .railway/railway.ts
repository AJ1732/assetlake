import { defineRailway, github, preserve, project, service } from "railway/iac";

// Railway reads this file only through `railway config plan` / `railway config apply`, never on
// deploy. The spec is declarative: a variable missing from `env` is removed on apply, so secrets
// are declared with preserve() and their values live only in Railway.
export default defineRailway(() => {
  const demoWeb = service("demo-web", {
    // Repo root, not apps/demo-web: the pnpm workspace install needs the root lockfile.
    // Deploys from main (moved from dev on 2026-10-05). Applying this file sets the trigger branch.
    // checkSuites: Railway waits for the GitHub checks (the ci workflow's `gate`) to pass first.
    source: github("AJ1732/assetlake", { branch: "main", checkSuites: true }),
    build: {
      builder: "RAILPACK",
      buildCommand: "pnpm --filter @assetlake/demo-web... build",
      watchPatterns: [
        "apps/demo-web/**",
        "packages/**",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
      ],
    },
    start: "pnpm --filter @assetlake/demo-web start",
    healthcheck: "/",
    healthcheckTimeout: 120,
    // The upload quota's in-process counters assume a single replica: a second one would double
    // the per-session and daily limits.
    replicas: 1,
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 3 },
    // Read at import by lib/server/env.ts, so `next build` needs them too. Railway exposes service
    // variables at build time. NODE_ENV is left to `next start`, which sets production.
    env: {
      SANITY_PROJECT_ID: "oshzwvjy",
      SANITY_DATASET: "production",
      SANITY_API_VERSION: "2026-10-04",
      ASSETLAKE_DAILY_UPLOAD_CAP: "200",
      SANITY_WRITE_TOKEN: preserve(),
      ASSETLAKE_DEMO_PASSCODE: preserve(),
      ASSETLAKE_SESSION_SECRET: preserve(),
    },
  });

  return project("assetlake", { resources: [demoWeb] });
});
