import { createClient } from "@sanity/client";

import type { CliTarget } from "../environment";
import type { Probes } from "./probes";

// The Projects API is documented on its own version and on the global host, not the project one.
const PROJECTS_API_VERSION = "2021-06-07";
// Never written: the probe mutation always runs with dryRun.
const PROBE_DOCUMENT = {
  _id: "assetlake-doctor-probe",
  _type: "assetLakeDoctorProbe",
};

export function createSanityProbes(target: CliTarget): Probes {
  const { projectId, dataset, apiVersion, token } = target;
  const authenticated = createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: false,
  });
  const tokenless = createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
  });
  const projectsApi = createClient({
    apiVersion: PROJECTS_API_VERSION,
    token,
    useProjectHostname: false,
    useCdn: false,
  });

  return {
    countDocuments: () => authenticated.fetch<number>("count(*)"),
    countDocumentsWithoutToken: () => tokenless.fetch<number>("count(*)"),
    async dryRunWrite() {
      await authenticated.mutate([{ createIfNotExists: PROBE_DOCUMENT }], {
        dryRun: true,
      });
    },
    async corsOrigins() {
      const entries = await projectsApi.request<Array<{ origin: string }>>({
        url: `/projects/${projectId}/cors`,
      });
      return entries.map((entry) => entry.origin);
    },
  };
}
