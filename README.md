# AssetLake

Sanity-backed public image infrastructure: upload once through a trusted backend, keep structured metadata in Sanity Content Lake, and deliver transformed variants from Sanity's Asset CDN.

**Standard Content Lake assets are public by URL. AssetLake is for public images only.**

Full README lands at submission. This is the workspace map.

## Workspace

| Path                      | Package                    | Role                                                      |
| ------------------------- | -------------------------- | --------------------------------------------------------- |
| `apps/demo-web`           | `@assetlake/demo-web`      | Next.js 16 demo + Route Handler upload boundary (Railway) |
| `apps/asset-console`      | `@assetlake/asset-console` | Sanity App SDK operations console (added in B05)          |
| `packages/assetlake-core` | `@assetlake/core`          | Framework-neutral domain/service package                  |
| `packages/sanity-schema`  | `@assetlake/sanity-schema` | Content model, schema deploy, TypeGen, seed               |

## Requirements

Node 24.x (`.nvmrc`), pnpm via Corepack.

```bash
nvm use
corepack enable
pnpm install
pnpm check        # lint + typecheck + format check
pnpm test         # gate lane (Vitest, all projects)
pnpm test:live    # eval lane against a real Sanity dataset
pnpm test:e2e     # Playwright (demo-web)
pnpm build
pnpm dev          # demo-web on http://localhost:3000
```

Copy `.env.example` to `apps/demo-web/.env.local` and fill it in. Never commit `.env*` files.
