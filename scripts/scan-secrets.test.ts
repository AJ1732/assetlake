import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SCRIPT = fileURLToPath(new URL("scan-secrets.sh", import.meta.url));

// Built at runtime so this file never holds a string the scan would flag.
const secrets = {
  SANITY_WRITE_TOKEN: `fake-write-${randomBytes(16).toString("hex")}`,
  ASSETLAKE_SESSION_SECRET: `fake-session-${randomBytes(16).toString("hex")}`,
};
const tokenShapedString = "sk" + randomBytes(40).toString("hex");
const publicTokenName = ["NEXT", "PUBLIC", "SANITY", "TOKEN"].join("_");
const publicPrefix = "NEXT" + "_PUBLIC_";

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(path.join(tmpdir(), "scan-secrets-"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(workspace, { recursive: true, force: true });
});

// A git hook (pre-commit runs this suite) exports GIT_DIR and GIT_INDEX_FILE for the outer repo.
// Child processes must not inherit them, or `git init` reinitializes the real repository.
function isolatedEnvironment() {
  return { PATH: process.env.PATH, HOME: process.env.HOME };
}

function plant(relativePath: string, content: string): void {
  const file = path.join(workspace, relativePath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function scan(
  targets: string[],
  environment: Record<string, string | undefined> = secrets,
) {
  const result = spawnSync(SCRIPT, targets, {
    cwd: workspace,
    encoding: "utf8",
    env: { ...isolatedEnvironment(), ...environment },
  });
  return {
    status: result.status,
    stdout: result.stdout,
    output: result.stdout + result.stderr,
  };
}

function initGitRepository(): void {
  const result = spawnSync("git", ["init", "--quiet"], {
    cwd: workspace,
    env: isolatedEnvironment(),
  });
  expect(result.status).toBe(0);
  expect(existsSync(path.join(workspace, ".git"))).toBe(true);
  plant(".gitignore", ".env.local\n.next/\n");
}

describe("scan-secrets.sh on directories", () => {
  it("exits 0 on a clean directory", () => {
    plant("src/app.ts", "export const ok = true;\n");

    expect(scan([workspace]).status).toBe(0);
  });

  it("exits 1 and prints only the path when the write token value is planted", () => {
    plant("src/leak.ts", `const token = "${secrets.SANITY_WRITE_TOKEN}";\n`);

    const result = scan([workspace]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("src/leak.ts");
    expect(result.output).not.toContain(secrets.SANITY_WRITE_TOKEN);
  });

  it("exits 1 when the session secret value is planted", () => {
    plant("chunks/main.js", `var s="${secrets.ASSETLAKE_SESSION_SECRET}";`);

    const result = scan([workspace]);

    expect(result.status).toBe(1);
    expect(result.output).not.toContain(secrets.ASSETLAKE_SESSION_SECRET);
  });

  it("exits 1 on an sk-prefixed token-shaped string", () => {
    plant("chunks/main.js", `var t="${tokenShapedString}";`);

    const result = scan([workspace]);

    expect(result.status).toBe(1);
    expect(result.output).not.toContain(tokenShapedString);
  });

  it("exits 1 when a token variable carries the public env prefix", () => {
    plant("src/config.ts", `process.env.${publicTokenName};\n`);

    expect(scan([workspace]).status).toBe(1);
  });

  it("ignores node_modules and .git", () => {
    plant("node_modules/pkg/index.js", secrets.SANITY_WRITE_TOKEN);
    plant(".git/objects/blob", tokenShapedString);

    expect(scan([workspace]).status).toBe(0);
  });

  it("skips the token pattern in pnpm-lock.yaml but still finds a secret value there", () => {
    plant("pnpm-lock.yaml", `integrity: sha512-${tokenShapedString}==\n`);
    expect(scan([workspace]).status).toBe(0);

    plant("pnpm-lock.yaml", `token: ${secrets.SANITY_WRITE_TOKEN}\n`);
    expect(scan([workspace]).status).toBe(1);
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
  ])(
    "exits 2 without scanning when SANITY_WRITE_TOKEN is %s",
    (_label, value) => {
      plant("src/leak.ts", secrets.ASSETLAKE_SESSION_SECRET);

      const result = scan([workspace], {
        ...secrets,
        SANITY_WRITE_TOKEN: value,
      });

      expect(result.status).toBe(2);
      expect(result.output).toContain("SANITY_WRITE_TOKEN");
      expect(result.stdout).toBe("");
    },
  );

  it("does not flag camelCase identifiers that start with sk", () => {
    plant(
      "chunks/runtime.js",
      "taskAsyncStorageInstance.skipSelectionChangeEvent;",
    );

    expect(scan([workspace]).status).toBe(0);
  });

  it("does not flag prose about the public prefix beside a server token name", () => {
    plant(
      "app/docs.html",
      `<p>Never gets a ${publicPrefix} prefix.</p><pre>token: process.env.SANITY_WRITE_TOKEN</pre>`,
    );

    expect(scan([workspace]).status).toBe(0);
  });

  it("labels each hit with the check that found it", () => {
    plant("leak.txt", secrets.SANITY_WRITE_TOKEN);
    plant("shape.txt", tokenShapedString);

    const result = scan([workspace]);

    expect(result.stdout.trim().split("\n")).toEqual([
      `${path.join(workspace, "leak.txt")}  (secret value)`,
      `${path.join(workspace, "shape.txt")}  (token pattern)`,
    ]);
  });

  it("warns when the write token is shorter than the token pattern's floor", () => {
    plant("src/app.ts", "export const ok = true;\n");

    const result = scan([workspace], {
      ...secrets,
      SANITY_WRITE_TOKEN: "sk" + randomBytes(8).toString("hex"),
    });

    expect(result.status).toBe(0);
    expect(result.output).toContain("shorter than the token pattern's floor");
  });

  it("exits 2 when a target is not a directory", () => {
    expect(scan([path.join(workspace, "missing")]).status).toBe(2);
  });
});

describe("scan-secrets.sh on the repo", () => {
  it("creates its temp repo even when run from a git hook", () => {
    const outerGitDirectory = mkdtempSync(path.join(tmpdir(), "outer-git-"));
    vi.stubEnv("GIT_DIR", outerGitDirectory);

    try {
      initGitRepository();
      expect(readdirSync(outerGitDirectory)).toEqual([]);
    } finally {
      rmSync(outerGitDirectory, { recursive: true, force: true });
    }
  });

  it("skips gitignored files and reports untracked ones", () => {
    initGitRepository();
    plant(".env.local", `SANITY_WRITE_TOKEN=${secrets.SANITY_WRITE_TOKEN}\n`);
    expect(scan([]).status).toBe(0);

    plant("notes.txt", secrets.SANITY_WRITE_TOKEN);
    const result = scan([]);

    expect(result.status).toBe(1);
    expect(result.stdout.trim()).toBe("notes.txt  (secret value)");
  });

  it("says when build output is missing", () => {
    initGitRepository();

    const result = scan([]);

    expect(result.status).toBe(0);
    expect(result.output).toContain("build output not found");
  });

  it("scans static chunks and prerendered pages but not server bundles", () => {
    initGitRepository();
    plant("apps/demo-web/.next/static/chunks/main.js", "ok");
    plant(
      "apps/demo-web/.next/server/app/api/route.js",
      secrets.SANITY_WRITE_TOKEN,
    );
    expect(scan([]).status).toBe(0);

    plant(
      "apps/demo-web/.next/server/app/index.html",
      `<p>${secrets.ASSETLAKE_SESSION_SECRET}</p>`,
    );
    plant("apps/demo-web/.next/static/chunks/app.js", tokenShapedString);
    const result = scan([]);

    expect(result.status).toBe(1);
    expect(result.stdout.trim().split("\n")).toEqual([
      "apps/demo-web/.next/server/app/index.html  (secret value)",
      "apps/demo-web/.next/static/chunks/app.js  (token pattern)",
    ]);
  });
});
