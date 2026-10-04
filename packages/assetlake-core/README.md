# @assetlake/core

Framework-neutral AssetLake domain package: upload with policy enforcement, metadata documents, presets, and transformed delivery URLs over Sanity Content Lake assets.

Status: skeleton (B00). The public API lands in B02.

## Boundary

Must not depend on `next`, React, Express, Railway SDKs, browser-only APIs, or App SDK UI code (architecture lock §6.3). `src/dependencyBoundary.test.ts` fails the gate lane if `package.json` declares one.

## Scripts

```bash
pnpm --filter @assetlake/core test
pnpm --filter @assetlake/core typecheck
```
