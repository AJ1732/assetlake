import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import eslintPluginSimpleImportSort from "eslint-plugin-simple-import-sort";
import unicornPlugin from "eslint-plugin-unicorn";
import unusedImportsPlugin from "eslint-plugin-unused-imports";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: "apps/demo-web/" } },
  },
  {
    files: ["**/*.{js,ts,jsx,tsx,mjs,mts,cjs}"],
    plugins: {
      "simple-import-sort": eslintPluginSimpleImportSort,
      unicorn: unicornPlugin,
      "unused-imports": unusedImportsPlugin,
    },
    rules: {
      "@next/next/no-img-element": "warn",
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
      // Names that differ only in case collide on macOS's case-insensitive filesystem
      // (broke typecheck in B04), so every source file is kebab-case.
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/no-array-method-this-argument": "off",
      "unicorn/prefer-spread": "off",
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": "error",
      "react-hooks/exhaustive-deps": "off",
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
    // Architecture lock §6.3: core stays framework-neutral.
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
    files: ["apps/demo-web/{components,features,lib/public}/**/*.{ts,tsx}"],
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
    // asset-console is a Vite app inside the Sanity Dashboard, not Next: plain <img> is correct.
    files: ["apps/asset-console/**/*.{ts,tsx}"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    // The console ships to browsers: URL building comes from @assetlake/core/url only (B05 spec).
    files: ["apps/asset-console/src/**/*.{ts,tsx}"],
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
    "docs/**",
  ]),
]);

export default eslintConfig;
