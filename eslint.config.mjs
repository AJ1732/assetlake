import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import eslintPluginSimpleImportSort from "eslint-plugin-simple-import-sort";
import unicornPlugin from "eslint-plugin-unicorn";
import unusedImportsPlugin from "eslint-plugin-unused-imports";

const DEMO_WEB = "apps/demo-web";
const CONSOLE = "apps/asset-console";
const NEXT_APPS = [DEMO_WEB, "examples/nextjs"];
const NEXT_RULE = /^@next\/next\//;

const isGlobalIgnore = (config) =>
  Object.keys(config).every((key) => key === "ignores" || key === "name");

function scopeTo(directories, configs) {
  return configs.map((config) =>
    isGlobalIgnore(config)
      ? config
      : {
          ...config,
          files: directories.flatMap((directory) =>
            (config.files ?? ["**/*"]).map(
              (pattern) => `${directory}/${pattern}`,
            ),
          ),
        },
  );
}

// The console is React on Vite, not Next: it keeps Next's React, hooks, a11y and import rules
// (same plugin instances, so no second copy can conflict) without the @next/next ones.
function withoutNextRules(config) {
  const { "@next/next": _next, ...plugins } = config.plugins;
  const rules = Object.fromEntries(
    Object.entries(config.rules).filter(([name]) => !NEXT_RULE.test(name)),
  );
  return { ...config, name: "react (no next)", plugins, rules };
}

const nextReactBlock = nextVitals.find(({ name }) => name === "next");
if (!nextReactBlock)
  throw new Error(
    'eslint-config-next no longer has a "next" block; update eslint.config.mjs.',
  );

const USE_EFFECT_MESSAGE =
  "Direct useEffect is banned. Derive the value during render, do the work in the event handler, subscribe with useSyncExternalStore, reset with a key, or fetch with a data library.";

const eslintConfig = defineConfig([
  ...scopeTo(NEXT_APPS, nextVitals),
  ...scopeTo([CONSOLE], [withoutNextRules(nextReactBlock)]),
  ...nextTs,
  {
    files: NEXT_APPS.map((directory) => `${directory}/**`),
    settings: {
      next: { rootDir: NEXT_APPS.map((directory) => `${directory}/`) },
    },
    rules: {
      "@next/next/no-img-element": "warn",
    },
  },
  {
    files: ["**/*.{js,ts,jsx,tsx,mjs,mts,cjs}"],
    plugins: {
      "simple-import-sort": eslintPluginSimpleImportSort,
      unicorn: unicornPlugin,
      "unused-imports": unusedImportsPlugin,
    },
    rules: {
      "unicorn/no-array-callback-reference": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/no-array-reduce": "off",
      "unicorn/no-null": "off",
      "unicorn/prevent-abbreviations": [
        "error",
        {
          checkFilenames: false,
          allowList: { e2e: true },
          replacements: {
            props: false,
            ref: false,
            params: false,
          },
          ignore: ["ColumnDef"],
        },
      ],
      "unicorn/prefer-node-protocol": "off",
      // Names that differ only in case collide on macOS's case-insensitive filesystem (two such
      // files once broke typecheck), so every source file is kebab-case.
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/no-array-method-this-argument": "off",
      "unicorn/prefer-spread": "off",
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["apps/**/*.{js,jsx,ts,tsx,mjs,mts}"],
    rules: {
      "react-hooks/exhaustive-deps": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportSpecifier[imported.name='useEffect']",
          message: USE_EFFECT_MESSAGE,
        },
        {
          selector: "MemberExpression[property.name='useEffect']",
          message: USE_EFFECT_MESSAGE,
        },
      ],
    },
  },
  {
    // Type-aware rules. projectService finds each file's nearest tsconfig.json; files covered by a
    // differently named tsconfig name it with `project`.
    files: [
      "packages/**/*.{ts,tsx,mts}",
      `${DEMO_WEB}/**/*.{ts,tsx,mts}`,
      `${CONSOLE}/src/**/*.{ts,tsx}`,
    ],
    ignores: [`${CONSOLE}/src/**/*.test.ts`],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: [
      `${CONSOLE}/src/**/*.test.ts`,
      `${CONSOLE}/sanity.cli.ts`,
      `${CONSOLE}/*.config.mts`,
    ],
    languageOptions: {
      parserOptions: {
        project: `${CONSOLE}/tsconfig.node.json`,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["scripts/**/*.{ts,mts}", ".railway/**/*.ts", "sanity.blueprint.ts"],
    languageOptions: {
      parserOptions: {
        project: "tsconfig.tooling.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: [
      "packages/**/*.{ts,tsx,mts}",
      "apps/**/*.{ts,tsx,mts}",
      "scripts/**/*.{ts,mts}",
      ".railway/**/*.ts",
      "sanity.blueprint.ts",
    ],
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
  {
    // core stays framework-neutral so any Node server or framework can use it.
    files: ["packages/assetlake-core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["next", "react", "react-dom", "express"],
          patterns: [
            {
              group: ["next/*", "@sanity/sdk-react", "@sanity/ui"],
              message:
                "@assetlake/core must not depend on UI or framework code.",
            },
          ],
        },
      ],
    },
  },
  {
    // "@assetlake/core/url" ships to browsers: no write client, Node built-ins, or upload path.
    files: [
      "packages/assetlake-core/src/url.ts",
      "packages/assetlake-core/src/contracts.ts",
      "packages/assetlake-core/src/constants.ts",
      "packages/assetlake-core/src/delivery/image-urls.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["next", "react", "react-dom", "express"],
          patterns: [
            {
              group: [
                "@sanity/client",
                "node:*",
                "file-type",
                "zod",
                "**/store/*",
                "**/images/*",
                "**/client/*",
                "**/testing/*",
              ],
              message:
                "Browser-safe module: keep server-only code out of @assetlake/core/url.",
            },
          ],
        },
      ],
    },
  },
  {
    // demo-web code that can reach a browser bundle must not import the write path. Server-only
    // loaders opt out with the *.server.ts suffix (and `import "server-only"`).
    files: [`${DEMO_WEB}/{components,features,lib/public}/**/*.{ts,tsx}`],
    ignores: ["**/*.server.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@assetlake/core",
              message:
                "Holds the write token. Use @assetlake/core/url or @assetlake/core/contracts in client code.",
            },
            {
              name: "@assetlake/core/testing",
              message: "Test doubles are for *.test.ts files only.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/server/*", "**/lib/server/*"],
              message:
                "lib/server is server-only. Load data in a *.server.ts module or a Server Component.",
            },
          ],
        },
      ],
    },
  },
  {
    // The console ships to browsers, so it must never bundle the write client or token path.
    files: [`${CONSOLE}/src/**/*.{ts,tsx}`],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@assetlake/core",
              message: "Server entry. Import from @assetlake/core/url.",
            },
            {
              name: "@assetlake/core/testing",
              message: "Test doubles are for *.test.ts files only.",
            },
            {
              name: "@assetlake/image-review/server",
              message:
                "Drainer code with the write path. Import from @assetlake/image-review.",
            },
          ],
        },
      ],
    },
  },
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    "**/.next/**",
    "**/.vercel/**",
    "**/coverage/**",
    "**/out/**",
    "**/build/**",
    "**/dist/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/next-env.d.ts",
    "**/.sanity/**",
    "**/.build/**",
    "docs/**",
  ]),
]);

export default eslintConfig;
