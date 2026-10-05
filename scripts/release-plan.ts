// Pure half of `pnpm release:check` and `pnpm release:verify`. scripts/release.ts gathers the git and
// registry state; everything that decides what to print lives here so the gate lane can test it.

export interface ReleaseState {
  name: string;
  version: string;
  /** null when HEAD is detached */
  branch: string | null;
  clean: boolean;
  headIsPushed: boolean;
  tagExists: boolean;
  publishedVersions: readonly string[];
}

export interface RegistryState {
  latest: string | undefined;
  versions: readonly string[];
}

export function releaseTag(name: string, version: string): string {
  return `${name}@${version}`;
}

export function releaseProblems(state: ReleaseState): string[] {
  const tag = releaseTag(state.name, state.version);
  const problems: string[] = [];

  if (state.branch === null) {
    problems.push("HEAD is detached. Check out the branch you release from.");
  }
  if (!state.clean) {
    problems.push(
      "The working tree has uncommitted changes. Commit or stash them first.",
    );
  }
  if (state.branch !== null && !state.headIsPushed) {
    problems.push(
      `HEAD is not the tip of origin/${state.branch}. Push first, so the tag points at a commit origin has.`,
    );
  }
  if (state.publishedVersions.includes(state.version)) {
    problems.push(`${tag} is already on npm. Bump the version.`);
  }
  if (state.tagExists) {
    problems.push(`The tag ${tag} already exists.`);
  }

  return problems;
}

export function releaseCommands(state: ReleaseState): string[] {
  if (state.branch === null) {
    throw new Error(
      "releaseCommands needs a branch; check releaseProblems first.",
    );
  }

  const tag = releaseTag(state.name, state.version);
  // pnpm publish refuses to run on a branch other than main or master unless told which branch.
  const publishBranch =
    state.branch === "main" ? [] : ["--publish-branch", state.branch];

  return [
    [
      "pnpm",
      "--filter",
      state.name,
      "publish",
      "--access",
      "public",
      ...publishBranch,
    ].join(" "),
    `git tag -a ${tag} -m "${state.name} ${state.version}"`,
    `git push origin ${tag}`,
  ];
}

/** Reads the registry's package document. A package that was never published answers 404 with `{ error }`. */
export function readRegistry(document: unknown): RegistryState {
  if (typeof document !== "object" || document === null) {
    return { latest: undefined, versions: [] };
  }

  const { "dist-tags": distributionTags, versions } = document as {
    "dist-tags"?: { latest?: unknown };
    versions?: unknown;
  };
  const latest = distributionTags?.latest;

  return {
    latest: typeof latest === "string" ? latest : undefined,
    versions:
      typeof versions === "object" && versions !== null
        ? Object.keys(versions)
        : [],
  };
}

export function isLive(registry: RegistryState, version: string): boolean {
  return registry.latest === version;
}

export function registryUrl(name: string): string {
  return `https://registry.npmjs.org/${name.replace("/", "%2f")}`;
}
