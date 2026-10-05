# AssetLake + Next.js

A minimal Next.js 16 App Router app that uploads images to **your own** Sanity project with [`@assetlake/core`](https://www.npmjs.com/package/@assetlake/core). Route Handlers hold the token; the page builds `cdn.sanity.io` URLs in the browser with `@assetlake/core/url`, which needs no token.

## Run it

You need Node 24, a Sanity project and an Editor token. Create the setup documents once:

```sh
export ASSETLAKE_TOKEN=<editor token> ASSETLAKE_PROJECT_ID=<project id> ASSETLAKE_DATASET=production
npx @assetlake/cli init --slug my-app        # prints applicationId: assetlake-application-my-app
```

Then:

```sh
cp .env.example .env.local                   # fill in the values; EXAMPLE_LOCAL_USER=me
npm install
npm run dev                                  # http://localhost:3000
```

Pick a file or paste a URL, and the page shows the `640x360` crop from the CDN.

## How it fits together

| File                               | Role                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `lib/asset-lake.ts`                | `import "server-only"`; one `createAssetLake`, created on first request so `next build` needs no token |
| `app/api/images/route.ts`          | `POST` multipart `file`: byte upload, checked against your policy before anything reaches Sanity       |
| `app/api/images/from-url/route.ts` | `POST { url }`: Sanity fetches the URL (host must be in `ASSETLAKE_REMOTE_HOSTS`)                      |
| `app/api/images/[id]/route.ts`     | `DELETE`: owner only                                                                                   |
| `app/upload-form.tsx`              | Client component: posts to the routes, renders a preset with `createImageUrls`                         |
| `lib/current-user.ts`              | Auth stand-in that trusts `EXAMPLE_LOCAL_USER`                                                         |
| `lib/http-errors.ts`               | Core error codes to HTTP; server faults never echo upstream text                                       |

## What to change before you ship

- **Auth.** Replace `getCurrentUser` with your session lookup. The image `entity` and delete ownership come from it.
- **Never import `lib/asset-lake.ts` from a client component.** `server-only` turns that mistake into a build error.
- **Large files.** Upload to your bucket with a presigned PUT, then post a presigned GET URL to `/api/images/from-url`. Policy checks run after the upload, and a rejected file is public on the CDN until AssetLake deletes it.
