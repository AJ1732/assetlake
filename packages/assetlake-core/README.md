# @assetlake/core

Framework-neutral AssetLake domain package: policy-checked image upload to Sanity Content Lake, structured `assetLakeImage` records, Sanity-stored delivery presets, and transformed URLs served by `cdn.sanity.io`.

## Entry points

| Import                      | Where                               | What                                                                                     |
| --------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `@assetlake/core`           | Server only (holds the write token) | `createAssetLake`, contract types, errors, logger                                        |
| `@assetlake/core/url`       | Browser safe                        | `createImageUrls` (`buildUrl`, `buildResponsive`), `responsiveWidths`                    |
| `@assetlake/core/contracts` | Anywhere                            | Types and constants only (HTTP envelope, form field names, `Idempotency-Key`)            |
| `@assetlake/core/testing`   | Tests (Node)                        | `InMemoryStore`, `createPngBytes`, `signatureBytes`, `createManualClock`, `silentLogger` |

## Server usage

```ts
import { createAssetLake } from "@assetlake/core";

export const assetLake = createAssetLake({
  projectId: "oshzwvjy",
  dataset: process.env.SANITY_DATASET!,
  apiVersion: "2026-10-04",
  token: process.env.SANITY_WRITE_TOKEN!, // server only, never NEXT_PUBLIC_
});

const image = await assetLake.images.upload({
  body: new Uint8Array(await file.arrayBuffer()),
  filename: file.name,
  contentType: file.type,
  applicationId: "assetlake-application-campus-demo",
  purpose: "avatar",
  entity: { type: "user", id: session.userId },
  actorId: session.userId,
  idempotencyKey: request.headers.get("Idempotency-Key") ?? undefined,
});

const avatarUrl = await assetLake.images.url(image.id, { preset: "avatar" });
const responsive = await assetLake.images.responsive(image.id, {
  preset: "card",
});
await assetLake.images.delete({
  id: image.id,
  actorEntity: { type: "user", id: session.userId },
});
```

## Browser usage

```ts
import { createImageUrls } from "@assetlake/core/url";

const urls = createImageUrls({ projectId: "oshzwvjy", dataset: "production" });
const src = urls.buildUrl(image.assetId, {
  width: 256,
  height: 256,
  fit: "crop",
  autoFormat: true,
});
```

## Upload sequence

1. Same actor + same `idempotencyKey` returns the existing record without uploading.
2. Resolve application, then its policy.
3. Reject a disallowed declared MIME, an oversized body, or bytes whose signature (`file-type`) does not match the declared MIME. Nothing reaches Sanity.
4. Upload the asset with `client.assets.upload("image", ...)`.
5. Check dimensions against the policy, then create the `assetLakeImage` record (`review` if the policy requires it).
6. On any failure after step 4, delete the asset unless Sanity answers 409 (identical bytes dedupe to one asset that another record still references). The original error always surfaces.

Ids are `assetlake-image-<uuid>` or `assetlake-image-<sha256(actor:key)>`, never dotted, so tokenless public reads can see them.

## Errors

`AssetLakeError.code` is one of the `AssetLakeErrorCode` values in `contracts.ts`. Messages are safe to show users; causes carry the underlying Sanity error.

## Boundary

No `next`, React, Express, or UI imports (ESLint `no-restricted-imports` + `src/dependency-boundary.test.ts`). `@assetlake/core/url` additionally cannot reach `@sanity/client`, `node:*`, or the write path (`src/url-boundary.test.ts`).

## Tests

```bash
pnpm --filter @assetlake/core test   # gate lane, in-memory store, no network
pnpm test:live                        # eval lane: real upload chain against the `test` dataset
```
