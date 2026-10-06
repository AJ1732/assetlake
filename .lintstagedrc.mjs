const quote = (filenames) =>
  filenames.map((filename) => `"${filename}"`).join(" ");

// Typecheck and the full suite run in CI; the hook only checks what is staged.
const config = {
  "*.{js,jsx,ts,tsx,mjs,mts,cjs}": [
    (filenames) => `eslint --fix ${quote(filenames)}`,
    "prettier --write",
    (filenames) => `vitest related --run --passWithNoTests ${quote(filenames)}`,
  ],
  "*.{css,json,md,mdx,yml,yaml}": "prettier --write",
};

export default config;
