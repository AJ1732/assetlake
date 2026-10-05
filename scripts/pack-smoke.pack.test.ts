import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Pack lane: what npm users get. Packs core and the CLI exactly as `pnpm publish` would (prepack
// builds dist, publishConfig swaps exports, workspace: ranges are rewritten), installs both tarballs
// with npm into an empty project, then loads them with plain node.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN_SECRETS = path.join(ROOT, "scripts", "scan-secrets.sh");
const PACKAGES = {
  core: { directory: "packages/assetlake-core", prefix: "assetlake-core-" },
  cli: { directory: "packages/assetlake-cli", prefix: "assetlake-cli-" },
} as const;
type PackageKey = keyof typeof PACKAGES;
const PACKAGE_KEYS = Object.keys(PACKAGES) as PackageKey[];

// Same rule as scan-secrets.test.ts: children must not inherit GIT_* from a git hook, nor the
// npm_config_* that `pnpm test:pack` exports.
function isolatedEnvironment(extra: Record<string, string | undefined> = {}) {
  return { PATH: process.env.PATH, HOME: process.env.HOME, ...extra };
}

function exec(
  command: string,
  commandArguments: string[],
  cwd: string,
): string {
  const result = spawnSync(command, commandArguments, {
    cwd,
    env: isolatedEnvironment(),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${commandArguments.join(" ")} exited ${result.status}\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout;
}

let work = "";
const tarballs = {} as Record<PackageKey, string>;
const unpacked = {} as Record<PackageKey, string>;
let consumer = "";

function manifestOf(key: PackageKey) {
  return JSON.parse(
    readFileSync(path.join(unpacked[key], "package.json"), "utf8"),
  ) as {
    version: string;
    exports?: Record<string, { types: string; default: string }>;
    dependencies?: Record<string, string>;
  };
}

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), "assetlake-pack-"));
  for (const key of PACKAGE_KEYS) {
    const { directory, prefix } = PACKAGES[key];
    exec(
      "pnpm",
      ["pack", "--pack-destination", work],
      path.join(ROOT, directory),
    );
    const tarball = readdirSync(work).find(
      (file) => file.startsWith(prefix) && file.endsWith(".tgz"),
    );
    if (!tarball) throw new Error(`pnpm pack produced no ${prefix}*.tgz`);
    tarballs[key] = path.join(work, tarball);

    const target = path.join(work, `${key}-unpacked`);
    mkdirSync(target);
    exec("tar", ["-xzf", tarballs[key], "-C", target], work);
    unpacked[key] = path.join(target, "package");
  }

  consumer = path.join(work, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    path.join(consumer, "package.json"),
    JSON.stringify({ name: "pack-smoke", private: true, type: "module" }),
  );
  exec(
    "npm",
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--loglevel=error",
      tarballs.core,
      tarballs.cli,
    ],
    consumer,
  );
});

afterAll(() => {
  if (work) rmSync(work, { recursive: true, force: true });
});

describe("packed tarballs", () => {
  it.each(PACKAGE_KEYS)(
    "%s ships only dist, its manifest, README and LICENSE",
    (key) => {
      const files = readdirSync(unpacked[key], {
        recursive: true,
        withFileTypes: true,
      })
        .filter((entry) => entry.isFile())
        .map((entry) =>
          path.relative(unpacked[key], path.join(entry.parentPath, entry.name)),
        );

      expect(files).toEqual(
        expect.arrayContaining(["package.json", "README.md", "LICENSE"]),
      );
      expect(
        files.filter(
          (file) =>
            !file.startsWith("dist/") &&
            !["package.json", "README.md", "LICENSE"].includes(file),
        ),
      ).toEqual([]);
    },
  );

  it.each(PACKAGE_KEYS)(
    "%s has no workspace: range left in its manifest",
    (key) => {
      expect(
        readFileSync(path.join(unpacked[key], "package.json"), "utf8"),
      ).not.toContain("workspace:");
    },
  );

  it("points core's exports at dist with a declaration file for each", () => {
    const exports = manifestOf("core").exports ?? {};

    expect(Object.keys(exports).sort()).toEqual([
      ".",
      "./contracts",
      "./testing",
      "./url",
    ]);
    for (const target of Object.values(exports)) {
      expect(target.default).toMatch(/^\.\/dist\/.+\.js$/);
      expect(existsSync(path.join(unpacked.core, target.default))).toBe(true);
      expect(existsSync(path.join(unpacked.core, target.types))).toBe(true);
    }
  });

  it("makes the CLI depend on the published core range", () => {
    expect(manifestOf("cli").dependencies?.["@assetlake/core"]).toBe(
      `^${manifestOf("core").version}`,
    );
  });

  it("contains no secret value and no token-shaped string", () => {
    const result = spawnSync(SCAN_SECRETS, [unpacked.core, unpacked.cli], {
      encoding: "utf8",
      env: isolatedEnvironment({
        SANITY_WRITE_TOKEN: process.env.SANITY_WRITE_TOKEN,
        ASSETLAKE_SESSION_SECRET: process.env.ASSETLAKE_SESSION_SECRET,
      }),
    });

    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});

describe("installed with npm and loaded by plain node", () => {
  it.each([
    ["@assetlake/core", "createAssetLake", "function"],
    ["@assetlake/core/url", "createImageUrls", "function"],
    ["@assetlake/core/contracts", "DOCUMENT_TYPES", "object"],
    ["@assetlake/core/testing", "InMemoryStore", "function"],
  ])("imports %s", (specifier, name, type) => {
    const script = `const module_ = await import(${JSON.stringify(specifier)}); console.log(typeof module_[${JSON.stringify(name)}]);`;

    expect(
      exec("node", ["--input-type=module", "-e", script], consumer).trim(),
    ).toBe(type);
  });

  it("runs the assetlake bin", () => {
    const bin = path.join(consumer, "node_modules", ".bin", "assetlake");

    expect(exec(bin, ["--help"], consumer)).toContain(
      "Usage: assetlake <command>",
    );
  });
});
