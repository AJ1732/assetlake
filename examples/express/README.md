# AssetLake + Express

A minimal Express 5 server that uploads images to **your own** Sanity project with [`@assetlake/core`](https://www.npmjs.com/package/@assetlake/core): byte uploads, upload-from-URL for large files, preset URLs and delete. The write token stays on this server.

## Run it

You need Node 24, a Sanity project and an Editor token. Create the setup documents once:

```sh
export ASSETLAKE_TOKEN=<editor token> ASSETLAKE_PROJECT_ID=<project id> ASSETLAKE_DATASET=production
npx @assetlake/cli init --slug my-app        # prints applicationId: assetlake-application-my-app
```

Then:

```sh
cp .env.example .env                         # fill in the values; EXAMPLE_LOCAL_USER=me
npm install
npm start                                    # http://localhost:3001
```

## Try it

```sh
# Upload bytes (core checks the bytes against the declared type and your policy first)
curl --data-binary @photo.png -H "content-type: image/png" localhost:3001/images

# A preset URL, served by cdn.sanity.io
curl "localhost:3001/images/<id>/url?preset=card"

# Upload from a URL: needs its host in ASSETLAKE_REMOTE_HOSTS
curl -H "content-type: application/json" \
  -d '{"url":"https://<allowed host>/photo.png"}' localhost:3001/images/from-url

# Delete (only the owner can)
curl -X DELETE localhost:3001/images/<id>
```

## What to change before you ship

- **Auth.** `src/current-user.ts` trusts `EXAMPLE_LOCAL_USER`. Replace it with your session lookup; the image `entity` and delete ownership come from it.
- **Limits.** `express.raw({ limit: "5mb" })` is a transport cap. The real rules (types, size, dimensions) live in the policy document `init` created; edit it in the Studio or with `createSetupPlan`.
- **Large files.** Have the client upload to your bucket with a presigned PUT (S3, R2, GCS), then post a presigned GET URL to `/images/from-url`, with the bucket host in `ASSETLAKE_REMOTE_HOSTS`. Sanity fetches the file; the bytes never pass through this server. The trade-off: policy checks run after the upload, and a rejected file is public on the CDN until AssetLake deletes it.

Files: `src/server.ts` (routes), `src/asset-lake.ts` (one `createAssetLake` per process), `src/http-errors.ts` (core error codes to HTTP), `src/current-user.ts` (the auth stand-in).
