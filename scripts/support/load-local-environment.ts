import { existsSync } from "node:fs";
import path from "node:path";

import { ROOT } from "./pack-workspace";

// Secrets for the network lanes live in the root .env.local (never committed). Values already in
// the shell win, so CI's environment secrets are never overwritten by a stale local file.
export function loadLocalEnvironment(): void {
  const file = path.join(ROOT, ".env.local");
  if (existsSync(file)) process.loadEnvFile(file);
}
