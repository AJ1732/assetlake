const buildEslintCommand = (filenames) =>
  `eslint --fix ${filenames.map((filename) => `"${filename}"`).join(" ")}`;

const config = {
  "*.{js,jsx,ts,tsx,mjs,mts,cjs}": [buildEslintCommand, "prettier --write"],
  "*.{css,json,md,mdx,yml,yaml}": "prettier --write",
};

export default config;
