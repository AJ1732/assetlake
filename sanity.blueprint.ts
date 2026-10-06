// Sanity Functions for the image review workflow. Lives at the root beside pnpm-lock.yaml:
// the Sanity CLI picks the package installer from the lockfile next to this file.
import { reviewDeployment } from "@assetlake/image-review";
import {
  drainTriggerFilter,
  parseReviewerIds,
  REVIEWER_IDS_VARIABLE,
  START_TRIGGER,
} from "@assetlake/image-review/server";
import {
  type EnvironmentSource,
  resolveSanityProject,
} from "@assetlake/sanity-schema/project";
import {
  defineBlueprint,
  defineDocumentFunction,
  defineRobotToken,
} from "@sanity/blueprints";

const REVIEW_DATASET = "production";
const ROBOT = "assetlake-image-review";
const FUNCTION_SOURCE = "./packages/image-review/functions";

export function imageReviewBlueprint(environment: EnvironmentSource) {
  const { projectId } = resolveSanityProject(environment, {
    projectId: "SANITY_PROJECT_ID",
    dataset: "SANITY_DATASET",
  });
  // Read from the deploying shell so no reviewer id is committed. Missing fails the deploy.
  const reviewerIds = parseReviewerIds(environment[REVIEWER_IDS_VARIABLE]);
  const { tag } = reviewDeployment({ projectId, dataset: REVIEW_DATASET });
  const datasetResource = {
    type: "dataset" as const,
    id: `${projectId}.${REVIEW_DATASET}`,
  };
  const robotToken = `$.resources.${ROBOT}.token`;

  return defineBlueprint({
    resources: [
      defineRobotToken({
        name: ROBOT,
        label: "AssetLake image review",
        memberships: [
          {
            resourceType: "project",
            resourceId: projectId,
            roleNames: ["editor"],
          },
        ],
      }),
      defineDocumentFunction({
        name: "image-review-drain",
        src: `${FUNCTION_SOURCE}/image-review-drain`,
        project: projectId,
        robotToken,
        env: { [REVIEWER_IDS_VARIABLE]: reviewerIds.join(",") },
        event: {
          on: ["create", "update"],
          filter: drainTriggerFilter(tag),
          projection: "{_id}",
          resource: datasetResource,
        },
      }),
      defineDocumentFunction({
        name: "image-review-start",
        src: `${FUNCTION_SOURCE}/image-review-start`,
        project: projectId,
        robotToken,
        event: {
          on: [...START_TRIGGER.on],
          filter: START_TRIGGER.filter,
          projection: START_TRIGGER.projection,
          resource: datasetResource,
        },
      }),
    ],
  });
}

export default imageReviewBlueprint(process.env);
