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

## Use AssetLake with your own Sanity project

AssetLake is not a hosted service. Your Sanity project is the bucket: your server holds the token, the images and their records live in your dataset, and browsers load them from `cdn.sanity.io/images/<yourProjectId>/<dataset>/...`. Nothing goes through this repo's demo or its project.

**What you get compared with S3 or R2:** uploads that are checked against a policy you store as content (types, size, magic bytes, dimensions), structured records per image, and resized, cropped, format-negotiated variants from named presets, with no image server of your own.
**What you don't get:** private files (assets are public by URL), quotas beyond your Sanity plan's asset and bandwidth limits, or transforms for non-images. Deleting an asset does not instantly purge CDN caches.

### 1. Project, dataset, token

- A Sanity project with a **public** dataset (AssetLake is for public images).
- A token with the **Editor** role, created in [sanity.io/manage](https://www.sanity.io/manage) → API → Tokens. Keep it in your server's environment only. Never prefix it with `NEXT_PUBLIC_` and never send it to a browser.

### 2. Create a policy, a preset and an application

Uploads resolve an application, then its default policy. Presets are looked up by slug across the dataset. Run this once from a trusted machine (Node 24, `npm i @sanity/client`):

```js
// setup-assetlake.mjs: SANITY_PROJECT_ID=... SANITY_DATASET=... SANITY_WRITE_TOKEN=... node setup-assetlake.mjs
import { createClient } from "@sanity/client";

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  apiVersion: "2026-10-04",
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
});
const slug = (current) => ({ _type: "slug", current });
const ref = (id) => ({ _type: "reference", _ref: id });

// No "." in ids: dotted ids are private paths that tokenless reads of a public dataset can't see.
await client
  .transaction()
  .createIfNotExists({
    _id: "my-policy",
    _type: "assetLakePolicy",
    name: "Public images",
    slug: slug("public-images"),
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFileSizeBytes: 5 * 1024 * 1024,
    requiresReview: false,
  })
  .createIfNotExists({
    _id: "my-preset-thumb",
    _type: "assetLakePreset",
    name: "Thumbnail",
    slug: slug("thumb"),
    width: 200,
    height: 200,
    fit: "crop",
    quality: 80,
    autoFormat: true,
  })
  .createIfNotExists({
    _id: "my-application",
    _type: "assetLakeApplication",
    name: "My app",
    slug: slug("my-app"),
    environment: "production",
    defaultPolicy: ref("my-policy"),
    presets: [{ _key: "thumb", ...ref("my-preset-thumb") }],
  })
  .commit({ visibility: "sync" });
```

Deploying the schema in `packages/sanity-schema` is optional. The Content Lake doesn't need it; it's for Studio editing, TypeGen and the console.

### 3. Upload from your backend

```ts
import { createAssetLake } from "@assetlake/core";

const assetLake = createAssetLake({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  apiVersion: "2026-10-04",
  token: process.env.SANITY_WRITE_TOKEN!,
});

const image = await assetLake.images.upload({
  body: bytes, // Uint8Array
  filename: "photo.png",
  contentType: "image/png",
  applicationId: "my-application",
  purpose: "avatar",
  entity: { type: "user", id: userId },
  actorId: userId,
});
const thumbUrl = await assetLake.images.url(image.id, { preset: "thumb" });
```

Any server works the same way: Express, Fastify, Next.js Route Handlers, workers, scripts. Browsers build variant URLs with `@assetlake/core/url` and never need the token. See [`packages/assetlake-core/README.md`](packages/assetlake-core/README.md) for the full API.

`packages/assetlake-core/tests/live/byo-project.live.test.ts` runs steps 2 and 3 against a real dataset in the live lane (`pnpm test:live`).

### Install today, and what's next

`@assetlake/core` is not on npm yet. Today you clone this repo and use the workspace package. Next on the roadmap: `@assetlake/core` on npm, plus an `@assetlake/cli` (`assetlake init` creates the documents above, `assetlake upload <file>` prints the CDN URL, `assetlake doctor` checks the token, dataset and CORS).
