# AssetLake Console

A custom [Sanity App SDK](https://www.sanity.io/docs/app-sdk) app for AssetLake operators. It runs inside the Sanity Dashboard and reads the Content Lake directly. It never calls the demo-web API and holds no token: the App SDK authenticates as the signed-in Dashboard user.

## Screens

| Screen       | Answers                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview     | How many image records, by status and purpose, the 8 newest uploads, and the original bytes of listed assets                                 |
| Assets       | Every record with its `avatar-sm` thumbnail, filterable by application, purpose and status                                                   |
| Asset detail | Original image, Sanity asset id, AssetLake document id, CDN URL, technical metadata, LQIP, and every preset applied to it with copyable URLs |
| Presets      | Edit `quality` and `width`, preview the result live on a chosen image, then publish                                                          |

Everything updates live through the Live Content API. An upload from demo-web appears without a reload.

## Preset edits: draft, then publish

Edits are saved to a draft through `useEditDocument`, and the previews update immediately. `@assetlake/core` reads presets with the `published` perspective and caches them for 60 seconds, so a change reaches demo-web only after **Publish**, within about 60 seconds. Publish is disabled while a field is invalid, because core rejects invalid presets.

## App SDK hooks used

| Hook                                                                | Where                                                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `useQuery`                                                          | Image list (Overview and Assets share one live subscription), preset lists in the `drafts` and `published` perspectives |
| `useDocumentProjection`                                             | Asset detail                                                                                                            |
| `useDocument`, `useEditDocument`                                    | Preset editor                                                                                                           |
| `useApplyDocumentActions` with `publishDocument`, `discardDocument` | Publish or discard a preset draft                                                                                       |
| `useCurrentUser`                                                    | Header avatar                                                                                                           |

Delivery URLs come from `@assetlake/core/url`, the browser-safe entry point. ESLint blocks imports of the core server entry from app code.

## Commands

Run from the repository root.

```bash
pnpm --filter @assetlake/asset-console dev                           # production dataset
SANITY_APP_DATASET=test pnpm --filter @assetlake/asset-console dev   # test dataset, safe for preset experiments
pnpm --filter @assetlake/asset-console test
pnpm --filter @assetlake/asset-console typecheck
```

`dev` prints a Dashboard URL. The app only renders there, signed in with a Sanity account that is a member of the project.

Deploy (the first deploy creates the app; save the returned `application.id` as `deployment.appId` in `sanity.cli.ts`):

```bash
cd apps/asset-console
env -u SANITY_APP_DATASET pnpm exec sanity deploy --create --title "AssetLake Console" --yes --json
```

`env -u` guarantees the deployed build reads `production` even if `SANITY_APP_DATASET` is set in your shell.

## Tests

Gate tests cover the pure data layer in `src/data/`: aggregation, filters, view models, the preset mapper (checked against core's own resolver), the draft diff, and the dataset fallback. One test fails if any app source file uses the word "bandwidth", because the byte total is a sum of original file sizes, not account usage (handoff §31 rule 11).

The screens run inside the authenticated Dashboard, so they are verified by the manual §21.3 checklist rather than Playwright.
