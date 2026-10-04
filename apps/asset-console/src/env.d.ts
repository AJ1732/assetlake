// The Sanity CLI builds apps with Vite and envPrefix "SANITY_APP_", so these reach import.meta.env.
// eslint-disable-next-line unicorn/prevent-abbreviations -- Vite's global interface name
interface ImportMetaEnv {
  readonly SANITY_APP_DATASET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
