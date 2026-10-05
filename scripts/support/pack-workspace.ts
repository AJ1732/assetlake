import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));

// Children must not inherit GIT_* from a git hook (a bare `git init` once reinitialized the real
// repo), nor the npm_config_* that `pnpm <script>` exports.
export function isolatedEnvironment(
  extra: Record<string, string | undefined> = {},
) {
  return { PATH: process.env.PATH, HOME: process.env.HOME, ...extra };
}

export function exec(
  command: string,
  commandArguments: string[],
  cwd: string,
  environment = isolatedEnvironment(),
): string {
  const result = spawnSync(command, commandArguments, {
    cwd,
    env: environment,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${commandArguments.join(" ")} exited ${result.status}\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout;
}

/** `pnpm pack` exactly as publish would (prepack build, publishConfig, workspace: rewrite). */
export function packWorkspacePackage(
  directory: string,
  destination: string,
): string {
  const before = new Set(readdirSync(destination));
  exec(
    "pnpm",
    ["pack", "--pack-destination", destination],
    path.join(ROOT, directory),
  );
  const tarball = readdirSync(destination).find(
    (file) => file.endsWith(".tgz") && !before.has(file),
  );
  if (!tarball)
    throw new Error(`pnpm pack produced no tarball for ${directory}`);
  return path.join(destination, tarball);
}
