import { parseArgs, type ParseArgsOptionsConfig } from "node:util";

import { isAssetLakeError } from "@assetlake/core";

import { describeError, UsageError } from "./cli-errors";
import { doctor } from "./commands/doctor";
import { init } from "./commands/init";
import { upload } from "./commands/upload";
import { url } from "./commands/url";
import {
  type CliEnvironment,
  type CliTarget,
  resolveTarget,
  secretValues,
} from "./environment";
import { type CliIo, type CommandResult, formatJson, scrub } from "./output";
import type { CliRuntime } from "./runtime";

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

export const USAGE = `Usage: assetlake <command> [options]

Commands:
  init              Create the upload policy, presets and application in your dataset
  upload <file>     Upload an image; prints its record and CDN URL
  url <imageId>     Print an image's CDN URL for a preset
  doctor            Check the token, dataset visibility, setup documents and CORS

Target (all commands):
  --project <id>    Sanity project id (default: ASSETLAKE_PROJECT_ID)
  --dataset <name>  Dataset (default: ASSETLAKE_DATASET, then "production")

init      --slug <slug> (default my-app)  --name <name>  --environment <env>  --reset
upload    --app <applicationId> (required)  --purpose <purpose> (default content)
          --entity-type <type> --entity-id <id>  --alt <text>  --tag <tag> (repeatable)
          --preset <slug>
url       --preset <slug> (required)
doctor    --slug <slug> (default my-app)

Token: set ASSETLAKE_TOKEN (or SANITY_AUTH_TOKEN) to a token with the Editor role.
Tokens are never accepted as flags. Output is one JSON document on stdout.
`;

const TOKEN_FLAG_MESSAGE =
  "--token is not accepted: a token in a flag ends up in shell history and the process list. Set ASSETLAKE_TOKEN (or SANITY_AUTH_TOKEN) instead.";

const TARGET_FLAGS: ParseArgsOptionsConfig = {
  project: { type: "string" },
  dataset: { type: "string" },
  help: { type: "boolean", short: "h" },
};

type FlagValue = string | boolean | Array<string | boolean> | undefined;
type FlagValues = Record<string, FlagValue>;

interface CommandContext {
  target: CliTarget;
  values: FlagValues;
  positionals: string[];
  runtime: CliRuntime;
}

interface CommandSpec {
  flags: ParseArgsOptionsConfig;
  positionals: readonly string[];
  execute(context: CommandContext): Promise<CommandResult>;
}

const text = (values: FlagValues, name: string) => {
  const value = values[name];
  return typeof value === "string" ? value : undefined;
};

const texts = (values: FlagValues, name: string) => {
  const value = values[name];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
};

function required(values: FlagValues, name: string): string {
  const value = text(values, name);
  if (!value) throw new UsageError(`Missing --${name}.`);
  return value;
}

const COMMANDS: Record<string, CommandSpec> = {
  init: {
    flags: {
      slug: { type: "string", default: "my-app" },
      name: { type: "string" },
      environment: { type: "string" },
      reset: { type: "boolean", default: false },
    },
    positionals: [],
    execute: ({ target, values, runtime }) =>
      init(
        { assetLake: runtime.createAssetLake(target) },
        {
          slug: required(values, "slug"),
          name: text(values, "name"),
          environment: text(values, "environment"),
          reset: values.reset === true,
        },
      ),
  },
  upload: {
    flags: {
      app: { type: "string" },
      purpose: { type: "string", default: "content" },
      "entity-type": { type: "string" },
      "entity-id": { type: "string" },
      alt: { type: "string" },
      tag: { type: "string", multiple: true },
      preset: { type: "string" },
    },
    positionals: ["file"],
    execute: ({ target, values, positionals: [file], runtime }) =>
      upload(
        {
          assetLake: runtime.createAssetLake(target),
          readFile: runtime.readFile,
        },
        {
          file,
          applicationId: required(values, "app"),
          purpose: required(values, "purpose"),
          entityType: text(values, "entity-type"),
          entityId: text(values, "entity-id"),
          alt: text(values, "alt"),
          tags: texts(values, "tag"),
          preset: text(values, "preset"),
        },
      ),
  },
  url: {
    flags: { preset: { type: "string" } },
    positionals: ["imageId"],
    execute: ({ target, values, positionals: [imageId], runtime }) =>
      url(
        { assetLake: runtime.createAssetLake(target) },
        { imageId, preset: required(values, "preset") },
      ),
  },
  doctor: {
    flags: { slug: { type: "string", default: "my-app" } },
    positionals: [],
    execute: ({ target, values, runtime }) =>
      doctor(
        {
          assetLake: runtime.createAssetLake(target),
          probes: runtime.createProbes(target),
        },
        {
          slug: required(values, "slug"),
          projectId: target.projectId,
          dataset: target.dataset,
        },
      ),
  },
};

const isTokenFlag = (argument: string) =>
  argument === "--token" || argument.startsWith("--token=");

function parseCommand(commandArguments: readonly string[], spec: CommandSpec) {
  try {
    return parseArgs({
      args: [...commandArguments],
      options: { ...TARGET_FLAGS, ...spec.flags },
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
}

async function dispatch(
  argv: readonly string[],
  environment: CliEnvironment,
  io: CliIo,
  runtime: CliRuntime,
): Promise<number> {
  if (argv.some(isTokenFlag)) throw new UsageError(TOKEN_FLAG_MESSAGE);

  const [name, ...commandArguments] = argv;
  if (name === undefined) {
    io.stderr(USAGE);
    return EXIT_USAGE;
  }
  if (name === "--help" || name === "-h" || name === "help") {
    io.stdout(USAGE);
    return EXIT_OK;
  }
  const spec = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;
  if (!spec) throw new UsageError(`Unknown command "${name}".`);

  const { values, positionals } = parseCommand(commandArguments, spec);
  if (values.help === true) {
    io.stdout(USAGE);
    return EXIT_OK;
  }
  if (positionals.length !== spec.positionals.length) {
    const expected = spec.positionals.map((positional) => `<${positional}>`);
    throw new UsageError(
      `"${name}" takes ${expected.length > 0 ? expected.join(" ") : "no arguments"}.`,
    );
  }

  const target = resolveTarget(
    { project: text(values, "project"), dataset: text(values, "dataset") },
    environment,
  );
  const result = await spec.execute({ target, values, positionals, runtime });
  io.stdout(scrub(formatJson(result.output), secretValues(environment)));
  return result.exitCode;
}

function describeFailure(error: unknown): string {
  if (error instanceof UsageError)
    return `assetlake: ${error.message}\nRun "assetlake --help" for usage.\n`;
  if (isAssetLakeError(error))
    return `assetlake: ${error.code}: ${error.message}\n`;
  return `assetlake: ${describeError(error)}\n`;
}

/** Exit codes: 0 success, 1 failure (including a failed doctor check), 2 usage error. */
export async function run(
  argv: readonly string[],
  environment: CliEnvironment,
  io: CliIo,
  runtime: CliRuntime,
): Promise<number> {
  try {
    return await dispatch(argv, environment, io, runtime);
  } catch (error) {
    io.stderr(scrub(describeFailure(error), secretValues(environment)));
    return error instanceof UsageError ? EXIT_USAGE : EXIT_FAILURE;
  }
}
