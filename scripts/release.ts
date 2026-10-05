// `pnpm release:check <package>` prints the publish commands once nothing blocks the release.
// `pnpm release:verify <package>` waits until npm serves the new version as latest.
// AJ runs the publish itself; this script never publishes, tags or pushes.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import {
  isLive,
  readRegistry,
  registryUrl,
  releaseCommands,
  releaseProblems,
  type ReleaseState,
  releaseTag,
} from "./release-plan";
import { ROOT } from "./support/pack-workspace";

const POLL_INTERVAL_MS = 15_000;
const VERIFY_TIMEOUT_MS = 10 * 60_000;
const STAGING_WARNING =
  "Publish once. npm stages a new version for a few minutes, and a retry in that window fails with 409 or 403 even though the first publish worked.";

function git(...gitArguments: string[]): { ok: boolean; output: string } {
  // Inherits the environment: ls-remote over SSH needs SSH_AUTH_SOCK.
  const result = spawnSync("git", gitArguments, {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { ok: result.status === 0, output: result.stdout.trim() };
}

function readWorkspaceManifest(name: string): { version: string } {
  const packagesDirectory = path.join(ROOT, "packages");
  const directories = readdirSync(packagesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const directory of directories) {
    const manifest = JSON.parse(
      readFileSync(
        path.join(packagesDirectory, directory, "package.json"),
        "utf8",
      ),
    ) as { name: string; version: string; private?: boolean };
    if (manifest.name !== name) continue;
    if (manifest.private) throw new Error(`${name} is private.`);
    return manifest;
  }
  throw new Error(`No package named ${name} under packages/.`);
}

async function fetchRegistry(name: string) {
  const response = await fetch(registryUrl(name), {
    headers: { accept: "application/json" },
  });
  // 404 is an answer (never published); anything else unexpected must not read as "not on npm".
  if (!response.ok && response.status !== 404) {
    throw new Error(`${registryUrl(name)} answered ${response.status}.`);
  }
  return readRegistry(await response.json());
}

function readRemoteReferences(references: string[]): string[] {
  const remote = git("ls-remote", "origin", ...references);
  // An unreachable origin must not read as "HEAD not pushed" or "tag missing".
  if (!remote.ok) throw new Error("git ls-remote origin failed.");
  return remote.output.split("\n");
}

async function readReleaseState(name: string): Promise<ReleaseState> {
  const { version } = readWorkspaceManifest(name);
  const tagReference = `refs/tags/${releaseTag(name, version)}`;
  const branchResult = git("symbolic-ref", "--short", "-q", "HEAD");
  const branch = branchResult.ok ? branchResult.output : null;
  const branchReference = branch ? [`refs/heads/${branch}`] : [];
  const head = git("rev-parse", "HEAD").output;
  const remoteLines = readRemoteReferences([...branchReference, tagReference]);

  return {
    name,
    version,
    branch,
    clean: git("status", "--porcelain").output === "",
    headIsPushed: remoteLines.includes(`${head}\trefs/heads/${branch}`),
    tagExists:
      git("rev-parse", "-q", "--verify", tagReference).ok ||
      remoteLines.some((line) => line.endsWith(`\t${tagReference}`)),
    publishedVersions: (await fetchRegistry(name)).versions,
  };
}

async function check(name: string): Promise<number> {
  const state = await readReleaseState(name);
  const problems = releaseProblems(state);
  if (problems.length > 0) {
    console.error(`Not ready to release ${releaseTag(name, state.version)}:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    return 1;
  }

  console.log(`Ready to release ${releaseTag(name, state.version)}. Run:\n`);
  for (const command of releaseCommands(state)) console.log(`  ${command}`);
  console.log(`\n${STAGING_WARNING}`);
  console.log(`Then run: pnpm release:verify ${name}`);
  return 0;
}

async function verify(name: string): Promise<number> {
  const { version } = readWorkspaceManifest(name);
  const tag = releaseTag(name, version);
  const deadline = Date.now() + VERIFY_TIMEOUT_MS;

  for (;;) {
    const registry = await fetchRegistry(name);
    if (isLive(registry, version)) {
      console.log(`${tag} is live: npm serves it as latest.`);
      return 0;
    }
    if (Date.now() >= deadline) {
      console.error(
        `${tag} is still not latest after ${VERIFY_TIMEOUT_MS / 60_000} minutes (latest: ${registry.latest}). Check ${registryUrl(name)} before doing anything else. Do not publish again.`,
      );
      return 1;
    }
    console.log(
      `Waiting: latest is ${registry.latest}. npm may still be staging ${tag}; do not publish again.`,
    );
    await sleep(POLL_INTERVAL_MS);
  }
}

const COMMANDS = { check, verify } as const;
const [commandName, packageName] = process.argv.slice(2);

if (!commandName || !packageName || !Object.hasOwn(COMMANDS, commandName)) {
  console.error("Usage: tsx scripts/release.ts check|verify <package-name>");
  process.exit(2);
}

process.exitCode =
  await COMMANDS[commandName as keyof typeof COMMANDS](packageName);
