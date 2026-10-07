import path from "node:path";

import { ESLint, type Linter } from "eslint";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ROOT } from "./support/pack-workspace";

const TYPED_RULES = [
  "@typescript-eslint/no-floating-promises",
  "@typescript-eslint/no-misused-promises",
];

const files = {
  core: "packages/assetlake-core/src/constants.ts",
  imageReview: "packages/image-review/src/index.ts",
  demoWeb: "apps/demo-web/components/copy-button.tsx",
  console: "apps/asset-console/src/components/copy-url.tsx",
  consoleTest: "apps/asset-console/src/data/format.test.ts",
  script: "scripts/release.ts",
} as const;

// Loading the config (eslint-config-next's plugins) alone takes about 3 s, hence the slow lane.
// The untyped instance checks AST rules without building a TypeScript program.
const untyped = new ESLint({
  cwd: ROOT,
  overrideConfig: {
    languageOptions: {
      parserOptions: { projectService: false, project: null },
    },
    rules: Object.fromEntries(TYPED_RULES.map((rule) => [rule, "off"])),
  },
});
// lintText lints a snippet under a real path. In single-run mode (inferred from CI=true)
// typescript-eslint builds its program from the files on disk, so a `project`-typed file would be
// parsed from disk against the snippet's text. CI=true is pinned so local runs match GitHub's.
vi.stubEnv("CI", "true");
const eslint = new ESLint({
  cwd: ROOT,
  overrideConfig: {
    languageOptions: {
      parserOptions: { disallowAutomaticSingleRunInference: true },
    },
  },
});
let configs: Record<keyof typeof files, Linter.Config>;

function severity(config: Linter.Config, rule: string) {
  const entry = config.rules?.[rule];
  const level = Array.isArray(entry) ? entry[0] : entry;
  return ({ 0: "off", 1: "warn", 2: "error" } as const)[level as 0] ?? level;
}

beforeAll(async () => {
  configs = Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([key, file]) => [
        key,
        (await eslint.calculateConfigForFile(
          path.join(ROOT, file),
        )) as Linter.Config,
      ]),
    ),
  ) as typeof configs;
});

describe("eslint.config.mjs", () => {
  it.each(Object.keys(files) as Array<keyof typeof files>)(
    "turns the promise rules on with type information for %s",
    (key) => {
      const parserOptions = configs[key].languageOptions?.parserOptions as
        | Linter.ParserOptions
        | undefined;
      for (const rule of TYPED_RULES)
        expect(severity(configs[key], rule)).toBe("error");
      expect(
        Boolean(parserOptions?.projectService || parserOptions?.project),
      ).toBe(true);
    },
  );

  it("applies Next's rules to demo-web only", () => {
    expect(severity(configs.demoWeb, "@next/next/no-img-element")).toBe("warn");
    for (const key of ["core", "imageReview", "console", "script"] as const)
      expect(configs[key].rules?.["@next/next/no-img-element"]).toBeUndefined();
  });

  it("keeps React hooks and a11y rules on the console", () => {
    expect(severity(configs.console, "react-hooks/rules-of-hooks")).toBe(
      "error",
    );
    expect(severity(configs.console, "jsx-a11y/alt-text")).toBe("warn");
  });

  it("bans useEffect in apps but not in Node scripts", () => {
    expect(severity(configs.demoWeb, "no-restricted-syntax")).toBe("error");
    expect(severity(configs.console, "no-restricted-syntax")).toBe("error");
    expect(configs.script.rules?.["no-restricted-syntax"]).toBeUndefined();
    expect(configs.core.rules?.["no-restricted-syntax"]).toBeUndefined();
  });

  it.each([
    [
      "a named useEffect import",
      'import { useEffect } from "react";\nuseEffect(() => {});\n',
    ],
    [
      "React.useEffect",
      'import * as React from "react";\nReact.useEffect(() => {});\n',
    ],
  ])("reports %s in app code", async (_label, code) => {
    const [result] = await untyped.lintText(code, {
      filePath: path.join(ROOT, files.demoWeb),
    });

    expect(
      result!.messages.filter(
        ({ ruleId }) => ruleId === "no-restricted-syntax",
      ),
    ).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("useSyncExternalStore"),
      }),
    ]);
  });
});

describe("type-aware promise rules", () => {
  const floating = (call: string) =>
    `async function work(): Promise<void> {}\nexport async function run() {\n  ${call}\n}\n`;

  async function promiseErrors(file: string, code: string) {
    const [result] = await eslint.lintText(code, {
      filePath: path.join(ROOT, file),
    });
    return result!.messages.filter(({ ruleId }) =>
      TYPED_RULES.includes(ruleId ?? ""),
    );
  }

  it.each([files.core, files.script])(
    "reports an unawaited promise in %s",
    async (file) => {
      expect(await promiseErrors(file, floating("work();"))).toEqual([
        expect.objectContaining({
          ruleId: "@typescript-eslint/no-floating-promises",
          severity: 2,
        }),
      ]);
    },
  );

  it.each([files.core, files.script])(
    "accepts an awaited or explicitly voided promise in %s",
    async (file) => {
      expect(await promiseErrors(file, floating("await work();"))).toEqual([]);
      expect(await promiseErrors(file, floating("void work();"))).toEqual([]);
    },
  );
});
