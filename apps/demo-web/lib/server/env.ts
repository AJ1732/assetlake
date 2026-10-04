// B04 stub, replaced by B03 at merge
import "server-only";

export interface ServerEnvironment {
  sanityProjectId: string;
  sanityDataset: string;
  sanityApiVersion: string;
  sanityWriteToken: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing required server environment variable ${name}.`);
  return value;
}

// eslint-disable-next-line unicorn/prevent-abbreviations -- name fixed by the B03 server module contract.
export const serverEnv: ServerEnvironment = {
  sanityProjectId: required("SANITY_PROJECT_ID"),
  sanityDataset: required("SANITY_DATASET"),
  sanityApiVersion: process.env.SANITY_API_VERSION ?? "2026-10-04",
  sanityWriteToken: required("SANITY_WRITE_TOKEN"),
};
