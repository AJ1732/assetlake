import { DOCUMENT_TYPES } from "@assetlake/core/contracts";
import {
  type GlobalDocumentReference,
  refDataset,
  type WorkflowResource,
} from "@sanity/workflow-engine";

export interface ReviewTarget {
  projectId: string;
  dataset: string;
}

/**
 * Engine documents live in the content dataset itself, one tag per dataset. Their ids are dotted
 * (`<tag>.wf-instance.<key>`), which keeps them out of tokenless reads of a public dataset.
 */
export function reviewDeployment({ projectId, dataset }: ReviewTarget): {
  tag: string;
  workflowResource: WorkflowResource;
} {
  return {
    tag: dataset,
    workflowResource: { type: "dataset", id: `${projectId}.${dataset}` },
  };
}

export function imageSubject(
  target: ReviewTarget,
  imageId: string,
): GlobalDocumentReference {
  return refDataset({
    ...target,
    documentId: imageId,
    type: DOCUMENT_TYPES.image,
  });
}

const INSTANCE_KEY_LENGTH = 12;

/**
 * The same image always maps to the same instance id, so a replayed start event, the console's
 * Start review button and the start Function resume one start instead of racing to create two.
 * Same shape as the engine's own ids, dot included.
 */
export async function reviewInstanceId(
  tag: string,
  imageId: string,
): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(imageId),
  );
  const key = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, INSTANCE_KEY_LENGTH);
  return `${tag}.wf-instance.${key}`;
}
