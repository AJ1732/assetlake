# @assetlake/sanity-schema

AssetLake content model, schema deployment config, TypeGen output, and the deterministic seed.

| Type                   | Role                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `assetLakeApplication` | Consuming app identity, default policy, allowed presets                                      |
| `assetLakePolicy`      | Server-enforced upload rules (MIME allowlist, max bytes, dimension bounds, review flag)      |
| `assetLakePreset`      | Named delivery transform (width, height, fit, crop, quality, auto format)                    |
| `assetLakeImage`       | Application meaning around a `sanity.imageAsset`: owner entity, purpose, status, upload time |

`assetLakeImage` does not copy URL, dimensions, MIME, or size. Those are read from the referenced asset so there is one source of truth.

## Subpath exports

- `@assetlake/sanity-schema`: schema types. Helpers come from `@sanity/types` (re-exported unchanged by `sanity`), so tests and core-adjacent code never load the Studio bundle.
- `@assetlake/sanity-schema/constants`: enums and document type names. No `sanity` import, safe for `@assetlake/core`.
- `@assetlake/sanity-schema/project`: public project id and defaults.

## Ids

Every seeded or AssetLake-created document id uses `assetlake-<type>-<slug-or-hash>` with no `.`. Sanity treats dotted ids as private paths that tokenless clients cannot read (sanity.io/docs/content-lake/ids).

## Scripts

Secrets come from the repo-root `.env.local` (`SANITY_WRITE_TOKEN`, optional `SANITY_DATASET`, `SANITY_API_VERSION`).

```bash
pnpm --filter @assetlake/sanity-schema test           # gate: schema shape, seed, config parsing
SANITY_AUTH_TOKEN=<deploy token> pnpm --filter @assetlake/sanity-schema schema:deploy
pnpm --filter @assetlake/sanity-schema schema:list
pnpm --filter @assetlake/sanity-schema typegen        # schema.json + src/sanity.types.ts
pnpm --filter @assetlake/sanity-schema seed           # create-if-missing: keeps live console edits
pnpm --filter @assetlake/sanity-schema seed:reset     # restores seeded preset values
SANITY_DATASET=test pnpm --filter @assetlake/sanity-schema seed
```

Eval lane (root): `pnpm test:live` seeds the `test` dataset twice and checks idempotency and tokenless readability.
