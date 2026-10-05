# @assetlake/sanity-schema

AssetLake content model, schema deployment config and TypeGen output.

| Type                   | Role                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `assetLakeApplication` | Consuming app identity, default policy, allowed presets                                      |
| `assetLakePolicy`      | Server-enforced upload rules (MIME allowlist, max bytes, dimension bounds, review flag)      |
| `assetLakePreset`      | Named delivery transform (width, height, fit, crop, quality, auto format)                    |
| `assetLakeImage`       | Application meaning around a `sanity.imageAsset`: owner entity, purpose, status, upload time |

`assetLakeImage` does not copy URL, dimensions, MIME, or size. Those are read from the referenced asset so there is one source of truth.

## Subpath exports

- `@assetlake/sanity-schema`: schema types. Helpers come from `@sanity/types` (re-exported unchanged by `sanity`), so tests and core-adjacent code never load the Studio bundle.
- `@assetlake/sanity-schema/project`: the demo's public project id and dataset as defaults, plus `resolveSanityProject(source, variables)`, the one reader every app, script and config uses to override them from the environment. Errors name the variable, never the value.

Enums and document type names live in `@assetlake/core/contracts` (moved there in B10 so the npm package has no Studio dependency). This package depends on core, never the reverse.

## Ids

Every seeded or AssetLake-created document id uses `assetlake-<type>-<slug-or-hash>` with no `.`. Sanity treats dotted ids as private paths that tokenless clients cannot read (sanity.io/docs/content-lake/ids). Setup document shapes are defined once, in core's `toSetupDocuments`.

## Scripts

```bash
pnpm --filter @assetlake/sanity-schema test           # gate: schema shape
SANITY_AUTH_TOKEN=<deploy token> pnpm --filter @assetlake/sanity-schema schema:deploy
SANITY_STUDIO_PROJECT_ID=<id> SANITY_STUDIO_DATASET=<dataset> pnpm --filter @assetlake/sanity-schema schema:deploy
pnpm --filter @assetlake/sanity-schema schema:list
pnpm --filter @assetlake/sanity-schema typegen        # schema.json + src/sanity.types.ts
```

The demo seed moved to the repo root in B10 (`scripts/seed-demo.ts`, run with `tsx`). It writes the campus-demo plan through core's setup module, the same code path as `assetlake init`. Secrets come from the root `.env.local` (`SANITY_WRITE_TOKEN`, optional `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_VERSION`).

```bash
pnpm seed                      # create-if-missing: keeps live console edits
pnpm seed:reset                # restores the seeded preset values
SANITY_DATASET=test pnpm seed
SANITY_PROJECT_ID=<your project> pnpm seed   # bring your own project
```
