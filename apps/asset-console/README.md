# AssetLake Console

A custom [Sanity App SDK](https://www.sanity.io/docs/app-sdk) app for AssetLake operators. It runs inside the Sanity Dashboard and reads the Content Lake directly. It never calls the demo-web API and holds no token: the App SDK authenticates as the signed-in Dashboard user.

## Screens

| Screen       | Answers                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview     | How many image records, by status and purpose, the 8 newest uploads, and the original bytes of listed assets                                  |
| Assets       | Every record with its `avatar-sm` thumbnail, filterable by application, purpose and status                                                    |
| Asset detail | Original image, Sanity asset id, AssetLake document id, CDN URL, technical metadata, LQIP, and every preset applied to it with copyable URLs  |
| Review       | Images held for review, oldest first: take the review, then approve or reject (a note is required). States that review is not confidentiality |
| Presets      | Edit `quality` and `width`, preview the result live on a chosen image, then publish                                                           |

Everything updates live through the Live Content API. An upload from demo-web appears without a reload.

## Preset edits: draft, then publish

Edits are saved to a draft through `useEditDocument`, and the previews update immediately. `@assetlake/core` reads presets with the `published` perspective and caches them for 60 seconds, so a change reaches demo-web only after **Publish**, within about 60 seconds. Publish is disabled while a field is invalid, because core rejects invalid presets.

## Review Queue

Built on [`@assetlake/image-review`](../../packages/image-review/README.md) and `@sanity/workflow-sdk` 0.36.0. `useWorkflowEngine` creates the engine as the signed-in user; `useDocumentWorkflows` finds the selected image's instance and `useWorkflowSession` renders only the actions the evaluation allows. A decision moves the instance to "Applying the decision"; the drain Function then sets the image to `ready` or `rejected`, and the list updates live.

The engine's checks (only the claimer decides) are advisory. Core's `transitionStatus` re-checks the reviewer allowlist and the status before anything changes. **Start review** covers an image the start Function missed; **Abort review** closes one whose image was deleted.

## App SDK hooks used

| Hook                                                                                       | Where                                                                                                                   |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `useQuery`                                                                                 | Image list (Overview and Assets share one live subscription), preset lists in the `drafts` and `published` perspectives |
| `useDocumentProjection`                                                                    | Asset detail                                                                                                            |
| `useDocument`, `useEditDocument`                                                           | Preset editor                                                                                                           |
| `useApplyDocumentActions` with `publishDocument`, `discardDocument`                        | Publish or discard a preset draft                                                                                       |
| `useCurrentUser`                                                                           | Header avatar                                                                                                           |
| `useWorkflowEngine`, `useDocumentWorkflows`, `useWorkflowSession` (`@sanity/workflow-sdk`) | Review Queue                                                                                                            |

Delivery URLs come from `@assetlake/core/url`, the browser-safe entry point. ESLint blocks imports of the core server entry from app code.

## Commands

Run from the repository root.

```bash
pnpm --filter @assetlake/asset-console dev                           # production dataset
SANITY_APP_DATASET=test pnpm --filter @assetlake/asset-console dev   # test dataset, safe for preset experiments
SANITY_APP_PROJECT_ID=<id> pnpm --filter @assetlake/asset-console dev # your own project (default: oshzwvjy)
pnpm --filter @assetlake/asset-console test
pnpm --filter @assetlake/asset-console typecheck
```

`dev` prints a Dashboard URL. The app only renders there, signed in with a Sanity account that is a member of the project.

Deploy. With nothing set, `sanity.cli.ts` deploys the demo console (organization `o5eRlVKEZ`). A fork sets these in `apps/asset-console/.env`, which the Sanity CLI loads. Only `SANITY_APP_*` reach the browser bundle; the `ASSETLAKE_CONSOLE_*` names are read by the CLI alone.

| Variable                            | Read by              | Default                                                |
| ----------------------------------- | -------------------- | ------------------------------------------------------ |
| `SANITY_APP_PROJECT_ID`             | the app (build time) | `oshzwvjy`                                             |
| `SANITY_APP_DATASET`                | the app (build time) | `production`                                           |
| `ASSETLAKE_CONSOLE_ORGANIZATION_ID` | `sanity.cli.ts`      | the demo's organization                                |
| `ASSETLAKE_CONSOLE_APP_ID`          | `sanity.cli.ts`      | the demo's app id, only when the organization is unset |

The first deploy in a new organization creates the app: leave `ASSETLAKE_CONSOLE_APP_ID` unset, run the command below, then save the returned `application.id` as `ASSETLAKE_CONSOLE_APP_ID`.

```bash
cd apps/asset-console
env -u SANITY_APP_DATASET pnpm exec sanity deploy --create --title "AssetLake Console" --yes --json
```

`env -u` guarantees the deployed build reads `production` even if `SANITY_APP_DATASET` is set in your shell.

## Tests

Gate tests cover the pure data layer in `src/data/`: aggregation, filters, view models, the preset mapper (checked against core's own resolver), the draft diff, and the project, dataset and deployment fallbacks. One test fails if any app source file uses the word "bandwidth", because the byte total is a sum of original file sizes, not account usage (handoff §31 rule 11).

The screens run inside the authenticated Dashboard, so they are verified by the manual §21.3 checklist rather than Playwright.
