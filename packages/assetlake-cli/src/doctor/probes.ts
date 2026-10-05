// Capability probes: each one tries what AssetLake actually does instead of asking for a role.
// The Sanity adapter is sanity-probes.ts; gate tests use a fake.
export interface Probes {
  /** count(*) with the token. Rejects (401/403) when the token is not accepted. */
  countDocuments(): Promise<number>;
  /** count(*) without a token. 0 on a private dataset, which answers 200 with empty results. */
  countDocumentsWithoutToken(): Promise<number>;
  /** A dry-run mutation: proves write access without writing anything. */
  dryRunWrite(): Promise<void>;
  /** Origins from the Projects API. Rejects (401/403) for tokens without project settings access. */
  corsOrigins(): Promise<string[]>;
}
