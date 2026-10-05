import "server-only";

import {
  SANITY_DATASET_PATTERN,
  SANITY_PROJECT_ID_PATTERN,
} from "@assetlake/core/contracts";
import {
  DEFAULT_API_VERSION,
  DEFAULT_DATASET,
  DEFAULT_PROJECT_ID,
} from "@assetlake/sanity-schema/project";
import { z } from "zod";

const serverEnvironmentSchema = z.object({
  SANITY_PROJECT_ID: z
    .string()
    .regex(SANITY_PROJECT_ID_PATTERN)
    .default(DEFAULT_PROJECT_ID),
  SANITY_DATASET: z
    .string()
    .regex(SANITY_DATASET_PATTERN)
    .default(DEFAULT_DATASET),
  SANITY_API_VERSION: z.string().min(1).default(DEFAULT_API_VERSION),
  SANITY_WRITE_TOKEN: z.string().min(1),
  ASSETLAKE_DEMO_PASSCODE: z.string().min(1),
  ASSETLAKE_SESSION_SECRET: z.string().min(32),
  ASSETLAKE_DAILY_UPLOAD_CAP: z.coerce.number().int().positive().default(200),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export const SERVER_ENVIRONMENT_VARIABLES = Object.keys(
  serverEnvironmentSchema.shape,
);

// eslint-disable-next-line unicorn/prevent-abbreviations -- name fixed by the B03/B04 server-module contract
export type ServerEnv = z.output<typeof serverEnvironmentSchema>;

// An empty `KEY=` line means unset, as in resolveSanityProject: .env.example ships blanks, and a
// blank optional variable should take its default rather than fail.
const withoutBlankValues = (source: Record<string, string | undefined>) =>
  Object.fromEntries(
    Object.entries(source).filter(([, value]) => value?.trim()),
  );

// The error names failing variables only; it never echoes values (the write token is one of them).
export function parseServerEnvironment(
  source: Record<string, string | undefined>,
): ServerEnv {
  const parsed = serverEnvironmentSchema.safeParse(withoutBlankValues(source));
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join("."));
    throw new Error(
      `Invalid demo-web server environment: ${[...new Set(names)].join(", ")}`,
    );
  }
  return parsed.data;
}

// eslint-disable-next-line unicorn/prevent-abbreviations -- name fixed by the B03/B04 server-module contract
export const serverEnv: ServerEnv = parseServerEnvironment(process.env);
