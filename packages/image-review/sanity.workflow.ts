import { resolveSanityProject } from "@assetlake/sanity-schema/project";
import { defineWorkflowConfig } from "@sanity/workflow-engine/define";

import { reviewDeployments } from "./src/deployments";

const { projectId } = resolveSanityProject(process.env, {
  projectId: "SANITY_PROJECT_ID",
  dataset: "SANITY_DATASET",
});

export default defineWorkflowConfig({
  deployments: reviewDeployments(projectId),
});
