# @assetlake/image-review

The review lifecycle for AssetLake images, built on [Sanity Workflows](https://www.sanity.io/docs/workflows) (early access, pinned at `0.36.0`). Private to this repo; not published.

An upload under a policy with `requiresReview: true` is stored as `review`. A workflow instance tracks it, a reviewer claims and decides in the asset console's Review Queue, and a Sanity Function applies the decision through `@assetlake/core`'s `images.transitionStatus`.

**Review governs lifecycle, not confidentiality.** The asset is public at its `cdn.sanity.io` URL from the moment it uploads. Rejecting it keeps it out of the apps; it doesn't make it private.

## Lifecycle

```text
upload (requiresReview) -> assetLakeImage.status = review
   |  Function image-review-start (create && status == "review"); the definition's
   |  start.filter says the same, so start pickers only offer held images
   v
[review]   claim, then approve / reject (note required)
   v
[applying] effect assetlake.apply-review {subject, decision, reviewer}
   |  Function image-review-drain -> core images.transitionStatus (robot token)
   +- ok, approve -> [approved]   status = ready
   +- ok, reject  -> [rejected]   status = rejected
   +- failed      -> [review]     decision cleared, reviewer kept
```

## What enforces what

| Check                             | Where                                              | Enforced?                |
| --------------------------------- | -------------------------------------------------- | ------------------------ |
| Only the claimer can decide       | workflow action filter                             | No: advisory, for the UI |
| Reviewer is on the allowlist      | core `transitionStatus` (`ASSETLAKE_REVIEWER_IDS`) | Yes, for the drainer     |
| Only `review -> ready / rejected` | core `transitionStatus`                            | Yes                      |
| Record unchanged since read       | `ifRevisionId` patch                               | Yes                      |
| Who can write at all              | Sanity project roles                               | Yes: the real boundary   |

The reviewer id the drainer passes comes from the workflow instance, which anyone with write access to the dataset could edit. The allowlist narrows whom the drainer acts for; it doesn't replace Sanity roles.

## Layout

| Path                                         | Holds                                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/image-review.workflow.ts`               | The definition and its stage, activity and action names                       |
| `src/review-target.ts`                       | One tag per dataset, deterministic dotted instance ids, the subject reference |
| `src/start-review.ts`                        | `startImageReview` (start Function, console, eval)                            |
| `src/apply-review-effect.ts`                 | The effect handler; never throws, records `ok` / `failed`                     |
| `src/function-runtime.ts`, `src/triggers.ts` | Engine and filters for the Functions                                          |
| `functions/*/index.ts`                       | The two Sanity Functions (thin)                                               |
| `sanity.workflow.ts`                         | Deployments `production` and `test`, reader model 10                          |
| `../../sanity.blueprint.ts`                  | Robot token + both Functions (at the repo root, beside the lockfile)          |

`.` is browser-safe (the console imports it); `./server` pulls in core's write path.

## Storage

Engine documents (`sanity.workflow.definition`, `sanity.workflow.instance`) live in the content dataset under tag = dataset name. Their ids are dotted (`production.wf-instance.<key>`), so tokenless reads of the public dataset never see them, including who reviewed what. The live eval asserts it.

## Commands

```bash
pnpm --filter @assetlake/image-review test                 # gate: bench + handler + config
pnpm --filter @assetlake/image-review exec sanity-workflows deploy --check
pnpm --filter @assetlake/image-review exec sanity-workflows deploy --deployment test
pnpm test:live                                             # eval: image-review.live.test.ts on `test`
```

From the repo root, Functions (production only):

```bash
ASSETLAKE_REVIEWER_IDS=<sanity user id> pnpm dlx sanity@latest blueprints deploy
```

## Recovery

- **Drain missed:** the instance waits in `applying` with a pending effect, and the console shows it there. Run `pnpm --filter @assetlake/image-review drain <instanceId>` with `SANITY_WRITE_TOKEN` and `ASSETLAKE_REVIEWER_IDS` set (`.env.local` is read). The Workflows CLI has no drain command in 0.36.
- **Start missed:** the console's Review Queue lists images in `review` with no workflow and offers **Start review**.
- **Image deleted mid-review:** the required subject blocks progress; abort the instance from the console.
- **Reset `test`:** `sanity-workflows nuke --deployment test`, then deploy again. The live eval leaves its terminal instances behind on purpose (generic edits to engine documents are off limits).
