import type { AssetLake, SetupPlan } from "@assetlake/core";

import { describeError, statusCodeOf } from "../cli-errors";
import type { Probes } from "../doctor/probes";
import type { CommandResult } from "../output";
import { toSetupPlan } from "./init";

export type CheckStatus = "pass" | "fail" | "skipped";

export interface DoctorCheck {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface DoctorOptions {
  slug: string;
  projectId: string;
  dataset: string;
}

type Outcome<T> = { ok: true; value: T } | { ok: false; error: unknown };

async function attempt<T>(probe: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await probe() };
  } catch (error) {
    return { ok: false, error };
  }
}

const isDenied = (error: unknown) =>
  statusCodeOf(error) === 401 || statusCodeOf(error) === 403;

const failed = (name: string, error: unknown): DoctorCheck => ({
  name,
  status: "fail",
  detail: describeError(error),
});

const TOKEN_DEPENDENT_CHECKS = ["write", "dataset-visibility", "setup", "cors"];

function tokenRejected(error: unknown): DoctorCheck[] {
  const token: DoctorCheck = isDenied(error)
    ? {
        name: "token",
        status: "fail",
        detail: `The token was rejected (${describeError(error)}). Check ASSETLAKE_TOKEN and that it belongs to this project.`,
      }
    : failed("token", error);
  return [
    token,
    ...TOKEN_DEPENDENT_CHECKS.map((name) => ({
      name,
      status: "skipped" as const,
      detail: "Needs a working token.",
    })),
  ];
}

function writeCheck(write: Outcome<void>): DoctorCheck {
  if (write.ok)
    return {
      name: "write",
      status: "pass",
      detail: "A dry-run write was accepted. Nothing was written.",
    };
  if (isDenied(write.error))
    return {
      name: "write",
      status: "fail",
      detail:
        "The token cannot write documents. Create a token with the Editor role.",
    };
  return failed("write", write.error);
}

// A private dataset answers tokenless queries with 200 and an empty result, not 401, so the only
// signal is comparing counts.
function visibilityCheck(
  documentCount: number,
  tokenless: Outcome<number>,
): DoctorCheck {
  const name = "dataset-visibility";
  if (documentCount === 0)
    return {
      name,
      status: "skipped",
      detail:
        "The dataset has no documents to compare. Run assetlake init first.",
    };
  if (!tokenless.ok) return failed(name, tokenless.error);
  return tokenless.value > 0
    ? {
        name,
        status: "pass",
        detail: "Public: records are readable without a token.",
      }
    : {
        name,
        status: "pass",
        detail:
          "Private: records need a token. Image URLs on cdn.sanity.io are still public.",
      };
}

function setupCheck(plan: SetupPlan, missing: Outcome<string[]>): DoctorCheck {
  if (!missing.ok) return failed("setup", missing.error);
  if (missing.value.length === 0)
    return {
      name: "setup",
      status: "pass",
      detail: `All setup documents for ${plan.application.id} exist.`,
    };
  return {
    name: "setup",
    status: "fail",
    detail: `Missing ${missing.value.join(", ")}. Run: assetlake init --slug ${plan.application.slug}`,
  };
}

function corsCheck(origins: Outcome<string[]>): DoctorCheck {
  if (origins.ok)
    return {
      name: "cors",
      status: "pass",
      detail:
        origins.value.length > 0
          ? `Allowed origins: ${origins.value.join(", ")}.`
          : "No CORS origins. Only browsers that query the dataset directly need one.",
    };
  if (isDenied(origins.error))
    return {
      name: "cors",
      status: "skipped",
      detail:
        "This token cannot read CORS settings (that needs the Administrator or Developer role). Check sanity.io/manage under API, CORS origins.",
    };
  return failed("cors", origins.error);
}

async function checksWithToken(
  deps: { assetLake: AssetLake; probes: Probes },
  plan: SetupPlan,
  documentCount: number,
): Promise<DoctorCheck[]> {
  const [write, tokenless, missing, origins] = await Promise.all([
    attempt(() => deps.probes.dryRunWrite()),
    attempt(() => deps.probes.countDocumentsWithoutToken()),
    attempt(() => deps.assetLake.setup.missing(plan)),
    attempt(() => deps.probes.corsOrigins()),
  ]);
  return [
    { name: "token", status: "pass", detail: "The token is accepted." },
    writeCheck(write),
    visibilityCheck(documentCount, tokenless),
    setupCheck(plan, missing),
    corsCheck(origins),
  ];
}

export async function doctor(
  deps: { assetLake: AssetLake; probes: Probes },
  options: DoctorOptions,
): Promise<CommandResult> {
  const plan = toSetupPlan({ slug: options.slug });
  const read = await attempt(() => deps.probes.countDocuments());
  const checks = read.ok
    ? await checksWithToken(deps, plan, read.value)
    : tokenRejected(read.error);
  const ok = checks.every((check) => check.status !== "fail");

  return {
    exitCode: ok ? 0 : 1,
    output: {
      ok,
      projectId: options.projectId,
      dataset: options.dataset,
      applicationId: plan.application.id,
      checks,
    },
  };
}
