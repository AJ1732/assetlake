// `pnpm typecheck:examples` typechecks every example against the workspace core, packed as
// publish would pack it. The examples depend on the npm range, which may not be published yet.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { listExamples, prepareExample } from "./support/examples";
import { exec, packWorkspacePackage } from "./support/pack-workspace";

const work = mkdtempSync(path.join(tmpdir(), "assetlake-examples-typecheck-"));
try {
  const coreTarball = packWorkspacePackage("packages/assetlake-core", work);
  for (const name of listExamples()) {
    exec("npm", ["run", "typecheck"], prepareExample(name, work, coreTarball));
    console.log(`examples/${name}: typecheck passed`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
