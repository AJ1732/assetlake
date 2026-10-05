import {
  type ApplicationEnvironment,
  type AssetLake,
  createSetupPlan,
  type SetupPlan,
} from "@assetlake/core";

import { UsageError } from "../cli-errors";
import type { CommandResult } from "../output";

export interface InitOptions {
  slug: string;
  name?: string;
  environment?: string;
  reset: boolean;
}

export function toSetupPlan(options: {
  slug: string;
  name?: string;
  environment?: string;
}): SetupPlan {
  try {
    return createSetupPlan({
      applicationSlug: options.slug,
      applicationName: options.name,
      environment: options.environment as ApplicationEnvironment | undefined,
    });
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
}

export async function init(
  deps: { assetLake: AssetLake },
  options: InitOptions,
): Promise<CommandResult> {
  const plan = toSetupPlan(options);
  const mode = options.reset ? "reset" : "create-if-missing";
  const { created, existing } = await deps.assetLake.setup.ensure(plan, {
    mode,
  });

  return {
    exitCode: 0,
    output: {
      event: "INIT_COMPLETED",
      mode,
      applicationId: plan.application.id,
      presets: plan.presets.map((preset) => preset.slug),
      created,
      ...(options.reset ? { replaced: existing } : { existing }),
    },
  };
}
