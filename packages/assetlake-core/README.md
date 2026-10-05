# @assetlake/core

Framework-neutral AssetLake domain package: policy-checked image upload to Sanity Content Lake, structured `assetLakeImage` records, Sanity-stored delivery presets, and transformed URLs served by `cdn.sanity.io`.

```bash
npm i @assetlake/core   # Node 24+, ESM only
```

Works against any Sanity project you own: you bring the project id, dataset and an Editor token. To create the setup documents from a terminal, use [`@assetlake/cli`](../assetlake-cli/README.md) (`npx @assetlake/cli init`).

## Entry points

| Import                      | Where                               | What                                                                                     |
| --------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `@assetlake/core`           | Server only (holds the write token) | `createAssetLake` (upload, `uploadFromUrl`, URLs, delete, setup), contract types, errors |
| `@assetlake/core/url`       | Browser safe                        | `createImageUrls` (`buildUrl`, `buildResponsive`), `responsiveWidths`                    |
| `@assetlake/core/contracts` | Anywhere                            | Types and constants only (document types, enums, HTTP envelope, `Idempotency-Key`)       |
| `@assetlake/core/testing`   | Tests (Node)                        | `InMemoryStore`, `createPngBytes`, `signatureBytes`, `createManualClock`, `silentLogger` |

## Server usage

```ts
import { createAssetLake } from "@assetlake/core";

export const assetLake = createAssetLake({
  projectId: process.env.SANITY_PROJECT_ID!, // your project; nothing here is tied to the demo's
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

## Set up a project

Uploads need an application, its default policy and the presets in your dataset. `createSetupPlan` validates them and fixes their ids (`assetlake-<kind>-<slug>`); `setup.ensure` writes them in one transaction and is safe to rerun:

```ts
import { createAssetLake, createSetupPlan } from "@assetlake/core";

const plan = createSetupPlan({ applicationSlug: "my-app" }); // starter policy + 4 presets
const result = await assetLake.setup.ensure(plan); // { created: [...], existing: [...] }
await assetLake.setup.missing(plan); // [] once everything exists
```

- Defaults: policy `public-images` (JPEG, PNG, WebP up to 5 MB), presets `avatar-sm`, `avatar`, `card`, `hero` (`STARTER_POLICY`, `STARTER_PRESETS`). Pass `policy` or `presets` to change them.
- The default mode is create-if-missing, so a rerun never overwrites presets edited in the Studio or the console. `{ mode: "reset" }` writes the plan's values back on purpose.
- **Presets are dataset-global.** `images.url(id, { preset })` resolves the slug across the whole dataset, not per application, and preset ids are `assetlake-preset-<slug>`. Two applications that use the slug `avatar` share one preset document. `application.presets` records which presets an app uses; it doesn't restrict resolution.
- `toSetupDocuments(plan)` returns the raw documents if you would rather write them yourself.

## Use it from any backend

The same `createAssetLake` call works in Express, Fastify, Next.js Route Handlers, queue workers and one-off scripts. The rule is that the token stays on the server. A script that uploads a file from disk:

```ts
// upload.ts: node upload.ts ./photo.png   (Node 24 runs this TypeScript directly)
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createAssetLake } from "@assetlake/core";

const assetLake = createAssetLake({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  apiVersion: "2026-10-04",
  token: process.env.SANITY_WRITE_TOKEN!,
});

const file = process.argv[2];
const image = await assetLake.images.upload({
  body: new Uint8Array(await readFile(file)),
  filename: path.basename(file),
  contentType: "image/png",
  applicationId: "assetlake-application-my-app",
  purpose: "content",
  entity: { type: "script", id: "local" },
  actorId: "local",
});

console.log(await assetLake.images.url(image.id, { preset: "avatar" }));
```

The npm package ships compiled ESM and `.d.ts` files, so plain `node` loads it. The application, policy and presets have to exist first (see "Set up a project", or run `npx @assetlake/cli init`). `contentType` must match the file's bytes: core checks the magic bytes against it.

## Upload from a URL (large files)

Sanity has no presigned uploads: every Assets API call needs a token, so browsers can't upload to Sanity directly. To keep large files off your server, have the browser upload to your own bucket with a presigned PUT (S3, R2, GCS), then hand AssetLake a presigned GET URL. Sanity fetches the file itself; the bytes never pass through your server and the token never leaves it.

```ts
const assetLake = createAssetLake({
  // ...projectId, dataset, apiVersion, token
  remoteUploads: { allowedHosts: ["my-bucket.s3.eu-west-1.amazonaws.com"] },
});

const image = await assetLake.images.uploadFromUrl({
  url: presignedGetUrl, // https only, on an allowed host
  filename: "photo.jpg", // optional
  applicationId: "assetlake-application-my-app",
  purpose: "content",
  entity: { type: "user", id: userId },
  actorId: userId,
});
```

- **Off by default.** With no `allowedHosts`, every call fails with `SOURCE_URL_NOT_ALLOWED` before any request. Whoever controls the URL decides what Sanity pulls into your dataset (and your bill), so list only your bucket's host. Patterns are exact hostnames or `*.example.com` for subdomains. URLs with credentials, ports or `http:` are refused.
- **Policy checks run after the upload.** Sanity fetches and decodes the file, then AssetLake checks its type, size and dimensions against the policy and deletes the asset if it fails. Until that delete lands, a rejected file is public on `cdn.sanity.io` (and CDN caches can outlive the delete). Use byte uploads where that window is unacceptable.
- **Errors:** `SOURCE_URL_NOT_ALLOWED` (refused before any request), `SOURCE_FETCH_FAILED` (the source was unreachable or timed out), `UNSUPPORTED_IMAGE_TYPE` (Sanity couldn't decode it as an image, or the policy forbids the type), `FILE_TOO_LARGE`, `DIMENSIONS_OUT_OF_RANGE`.
- **Timeouts.** Sanity may spend up to 300 s fetching (50 MiB limit). After a timeout the asset may already exist: retry with the same `idempotencyKey` so a completed first attempt is returned, not duplicated.
- **URLs are never logged or stored.** Presigned URLs carry signatures, so logs record only `sourceHost`, and error messages never echo the URL.

Working examples: [`examples/express`](../../examples/express) and [`examples/nextjs`](../../examples/nextjs).

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

`uploadFromUrl` follows the same sequence, except step 3 only checks the URL against `remoteUploads.allowedHosts`; the type, size and dimension checks run at step 5, on Sanity's analysis of the fetched file.

Ids are `assetlake-image-<uuid>` or `assetlake-image-<sha256(actor:key)>`, never dotted, so tokenless public reads can see them.

## Errors

`AssetLakeError.code` is one of the `AssetLakeErrorCode` values in `contracts.ts`. Messages are safe to show users; causes carry the underlying Sanity error.

## Boundary

No `next`, React, Express, UI, or `@assetlake/sanity-schema` imports (ESLint `no-restricted-imports` + `src/dependency-boundary.test.ts`). The schema package depends on core for the constants, not the other way round, so the npm package carries no Studio code. `@assetlake/core/url` additionally cannot reach `@sanity/client`, `node:*`, or the write path (`src/url-boundary.test.ts`).

## Build and publish

In the repo, `exports` point at `src/*.ts`, so the apps and Vitest need no build. `pnpm pack` and `pnpm publish` run `prepack` (tsdown builds `dist/`) and swap in `publishConfig.exports`. `src/package-manifest.test.ts` keeps the two export maps in step, and `pnpm test:pack` installs the real tarball in an empty project and imports every subpath with plain `node`.

## Tests

```bash
pnpm --filter @assetlake/core test   # gate lane, in-memory store, no network
pnpm test:live                        # eval lane: upload chain and setup against the `test` dataset
pnpm test:pack                        # pack lane: tarball installed with npm, loaded by plain node
```
