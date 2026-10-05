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

`SANITY_PROJECT_ID` and `SANITY_DATASET` pick the Sanity project (blank or unset: `oshzwvjy` / `production`). The server reads them in `lib/server/env.ts`; `/live` and `/docs` pass only those two values to the browser through `getPublicSanityTarget()` (`lib/server/sanity-target.ts`), as a Server Component prop. Both pages are rendered at build time, so changing the project needs a rebuild.

## Pages

| Route           | What it shows                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/`             | The write path (browser → Route Handler → Sanity) and the read path (browser → `cdn.sanity.io`). Public images only. |
| `/playground`   | Passcode login, upload, the normalized result, and the preset matrix rendered from `cdn.sanity.io`.                  |
| `/live`         | Uploads appearing without a reload, through the Live Content API and a tokenless client.                             |
| `/architecture` | Delivery options compared, and the known limitations.                                                                |
| `/docs`         | Four steps to set up `@assetlake/core` and render responsive images.                                                 |

## E2E

`test:e2e` runs two Playwright lanes. Specs that log in and upload need `ASSETLAKE_DEMO_PASSCODE` in the shell (or in `.env.local` for the API lane); without it they skip.

```bash
ASSETLAKE_DEMO_PASSCODE=... pnpm --filter @assetlake/demo-web test:e2e
```

- Stop `pnpm dev` first. Playwright reuses a running server, so the API lane would hit `production` instead of `test`.
- The UI lane writes to `production`. Its `uploads` fixture deletes what it creates.
- `PLAYWRIGHT_BASE_URL=<url>` points the specs at a deployed instance and skips the local server.

## Deploy

Railway, configured in `.railway/railway.ts` (Infrastructure as Code; Railway retired `railway.json` for new services). Railway does not read that file on deploy: run `railway config plan`, then `railway config apply` (Railway CLI 5.42.1 or newer).

- The service builds from the repo root with `pnpm --filter @assetlake/demo-web... build` and starts with `pnpm --filter @assetlake/demo-web start` on Node 24 (`engines.node`).
- `lib/server/env.ts` parses the environment at import, so the variables must exist at build time as well. Railway provides service variables to builds.
- Secrets are declared with `preserve()` and set in the Railway dashboard, never in the file. Use a fresh `ASSETLAKE_SESSION_SECRET` per environment.
- One replica: the upload quota keeps an in-process counter.
- The Railway origin must be in the Sanity project's CORS origins (no credentials) for `/live`.
