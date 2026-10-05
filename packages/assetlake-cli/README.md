# @assetlake/cli

Set up AssetLake in your own Sanity project, upload images and check the setup from a terminal. It is a thin layer over [`@assetlake/core`](../assetlake-core/README.md): every command calls the same code your backend would.

```bash
export ASSETLAKE_TOKEN=...            # a Sanity token with the Editor role
export ASSETLAKE_PROJECT_ID=abc123    # your project id
export ASSETLAKE_DATASET=production   # optional, defaults to production

npx @assetlake/cli init
npx @assetlake/cli upload ./photo.png --app assetlake-application-my-app --preset avatar
npx @assetlake/cli doctor
```

Node 24 or later. Install it globally (`npm i -g @assetlake/cli`) to get a plain `assetlake` command.

## Token handling

- The token comes only from `ASSETLAKE_TOKEN`, or `SANITY_AUTH_TOKEN` when that is unset. There is no `--token` flag: a token typed into a flag ends up in shell history and in the process list, so the CLI refuses one.
- Error messages name variables and fields, never values. Any output that would contain the token is scrubbed to `[redacted]`.
- Create the token in [sanity.io/manage](https://www.sanity.io/manage) under API, Tokens, with the **Editor** role. Keep it on trusted machines and servers only.

## Commands

Every command accepts `--project <id>` and `--dataset <name>`, which override the environment. Output is one JSON document on stdout (pipe it to `jq`); diagnostics and core's structured logs go to stderr.

| Command         | Does                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`          | Creates the upload policy, presets and application. Prints `{"event":"INIT_COMPLETED","created":[...],"existing":[...]}`. A second run creates nothing. |
| `upload <file>` | Detects the type from the file's bytes, refuses non-images before any request, uploads through the application's policy, prints the normalized record.  |
| `url <imageId>` | Prints the CDN URL for an image under a preset.                                                                                                         |
| `doctor`        | Checks the token, write access (a dry run, nothing written), dataset visibility, the setup documents and CORS origins. Exits 1 if any check fails.      |

### init

```bash
assetlake init [--slug my-app] [--name "My app"] [--environment production] [--reset]
```

Creates `assetlake-policy-public-images` (JPEG, PNG, WebP up to 5 MB), the presets `avatar-sm`, `avatar`, `card` and `hero`, and `assetlake-application-<slug>`. It never overwrites a document that exists, so presets edited in the Studio or the console survive a rerun. `--reset` writes the starter values back and prints the ids it replaced.

**Presets are dataset-global.** URLs resolve a preset by slug across the dataset, not per application, so a second `init --slug other-app` reuses the same four presets. To give an application its own presets, create them with `createSetupPlan` in code (see the core README).

### upload

```bash
assetlake upload <file> --app <applicationId> [--purpose content] [--preset avatar]
                 [--entity-type user --entity-id u_123] [--alt "..."] [--tag a --tag b]
```

`--app` takes the application id that `init` prints. `--purpose` is one of `avatar`, `cover`, `thumbnail`, `project`, `content`, `other`. With `--preset`, the output adds `presetUrl`.

### url

```bash
assetlake url <imageId> --preset card
```

### doctor

```bash
assetlake doctor [--slug my-app]
```

| Check                | Pass                                     | Notes                                                                                                                          |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `token`              | An authenticated query works             | On failure the other checks are skipped.                                                                                       |
| `write`              | A dry-run mutation is accepted           | Nothing is written. Fails for tokens without the Editor role.                                                                  |
| `dataset-visibility` | Reports public or private                | Compares counts with and without the token, because a private dataset answers tokenless queries with an empty result, not 401. |
| `setup`              | Every setup document for `--slug` exists | Lists missing ids and the `init` command that creates them.                                                                    |
| `cors`               | Lists the project's CORS origins         | `skipped` when the token can't read project settings (Sanity documents that as an Administrator or Developer permission).      |

## Exit codes

`0` success, `1` failure (including a failed `doctor` check or a refused file), `2` usage error.

## Limits

- Public images only: Sanity serves assets from `cdn.sanity.io` to anyone with the URL.
- Images only, in the types the Sanity image pipeline transforms.
- One file per `upload` call.
