# @assetlake/demo-web

Public demo and reference integration for AssetLake: a Next.js 16 App Router app whose Route Handlers are the trusted upload boundary. Images render directly from `cdn.sanity.io`; this app never proxies image reads.

## Scripts

```bash
pnpm --filter @assetlake/demo-web dev        # http://localhost:3000
pnpm --filter @assetlake/demo-web build
pnpm --filter @assetlake/demo-web typecheck
pnpm --filter @assetlake/demo-web test       # Vitest, *.test.ts(x)
pnpm --filter @assetlake/demo-web test:e2e   # Playwright, tests/**/*.spec.ts
```

First Playwright run needs browsers: `pnpm --filter @assetlake/demo-web exec playwright install chromium`.

## Environment

Copy the root `.env.example` to `apps/demo-web/.env.local`. `SANITY_WRITE_TOKEN` is server only and must never get a `NEXT_PUBLIC_` prefix.
