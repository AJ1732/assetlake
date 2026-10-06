import {
  imageSubject,
  REVIEW_ACTIVITY,
  startImageReview,
} from "@assetlake/image-review";
import {
  Badge,
  Button,
  Card,
  Flex,
  Spinner,
  Stack,
  Text,
  TextArea,
} from "@sanity/ui";
import { type Engine, errorMessage } from "@sanity/workflow-engine";
import { useDocumentWorkflows, useWorkflowSession } from "@sanity/workflow-sdk";
import { type ReactNode, useState } from "react";

import {
  type ReviewActionModel,
  reviewActions,
  reviewerId,
  reviewerLabel,
  stageLabel,
} from "../data/review-view-models";
import { useReviewEngine } from "../hooks/use-review";
import { SANITY_TARGET } from "../sanity-target";

/** One image's workflow: start it if the start Function missed it, otherwise drive its session. */
export function ReviewPanel({ imageId }: { imageId: string }) {
  const engine = useReviewEngine();
  const { instances, loading, error } = useDocumentWorkflows({
    engine,
    document: imageSubject(SANITY_TARGET, imageId).id,
  });

  if (error)
    return (
      <Notice tone="critical">
        Could not load this image&apos;s workflow: {errorMessage(error)}
      </Notice>
    );
  if (loading || !instances) return <Loading />;
  const [instance] = instances;
  if (!instance) return <StartReview engine={engine} imageId={imageId} />;
  return <ReviewSession engine={engine} instanceId={instance._id} />;
}

function ReviewSession({
  engine,
  instanceId,
}: {
  engine: Engine;
  instanceId: string;
}) {
  const session = useWorkflowSession({ engine, instanceId });
  const { pending, failure, run } = useCommit();

  if (session.invalid)
    return (
      <Notice tone="critical">
        This workflow can&apos;t be read: {session.invalid.reason}
      </Notice>
    );
  if (session.error)
    return (
      <Notice tone="critical">
        Could not load the workflow: {errorMessage(session.error)}
      </Notice>
    );
  if (session.evaluationError)
    return (
      <Notice tone="critical">
        Could not evaluate the workflow: {errorMessage(session.evaluationError)}
      </Notice>
    );
  if (!session.ready || !session.evaluation) return <Loading />;

  const { evaluation } = session;
  const stage = evaluation.instance.currentStage;
  const reviewer = reviewerId(evaluation.instance);
  const isBlocked = (evaluation.blockingMissingDocuments?.length ?? 0) > 0;
  const fire = (action: string, params?: Record<string, unknown>) =>
    run(() =>
      session.fireAction({ activity: REVIEW_ACTIVITY, action, params }),
    );

  return (
    <Stack gap={4}>
      <Flex gap={2} align="center" wrap="wrap">
        <Badge tone="primary" fontSize={1}>
          {stageLabel(stage)}
        </Badge>
        <Text size={1} muted>
          Reviewer: {reviewerLabel(reviewer, evaluation.actor.id)}
        </Text>
      </Flex>
      {isBlocked ? (
        <BlockedReview
          pending={pending}
          onAbort={() =>
            run(() =>
              engine.abortInstance({
                instanceId,
                reason: "The image was deleted during review.",
              }),
            )
          }
        />
      ) : stage === "applying" ? (
        <Text size={1} muted>
          The drainer is applying the decision to the image. This usually takes
          a few seconds.
        </Text>
      ) : (
        <ReviewActions
          actions={reviewActions(evaluation)}
          pending={pending}
          onFire={fire}
        />
      )}
      {failure ? <Notice tone="critical">{failure}</Notice> : null}
    </Stack>
  );
}

function ReviewActions({
  actions,
  pending,
  onFire,
}: {
  actions: ReviewActionModel[];
  pending: boolean;
  onFire: (action: string, params?: Record<string, unknown>) => void;
}) {
  const [note, setNote] = useState("");
  if (actions.length === 0)
    return (
      <Text size={1} muted>
        Nothing for you to do here right now.
      </Text>
    );

  const needsNote = actions.some((action) => action.needsNote);
  return (
    <Stack gap={3}>
      {needsNote ? (
        <Stack gap={2}>
          <Text as="label" htmlFor="review-note" size={1} weight="medium">
            Rejection note (required to reject)
          </Text>
          <TextArea
            id="review-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />
        </Stack>
      ) : null}
      <Flex gap={2} wrap="wrap">
        {actions.map((action) => (
          <Button
            key={action.name}
            text={action.title}
            tone={action.name === "reject" ? "critical" : "primary"}
            mode={action.name === "claim" ? "ghost" : "default"}
            disabled={
              pending || !action.allowed || (action.needsNote && !note.trim())
            }
            onClick={() =>
              onFire(
                action.name,
                action.needsNote ? { note: note.trim() } : undefined,
              )
            }
          />
        ))}
      </Flex>
    </Stack>
  );
}

function BlockedReview({
  pending,
  onAbort,
}: {
  pending: boolean;
  onAbort: () => void;
}) {
  return (
    <Stack gap={3}>
      <Notice tone="caution">
        The image this review points at is gone, so the workflow can&apos;t
        move. Abort it to close the review.
      </Notice>
      <Button
        text="Abort review"
        tone="critical"
        mode="ghost"
        disabled={pending}
        onClick={onAbort}
      />
    </Stack>
  );
}

function StartReview({ engine, imageId }: { engine: Engine; imageId: string }) {
  const { pending, failure, run } = useCommit();
  return (
    <Stack gap={3}>
      <Text size={1} muted>
        No review workflow is running for this image. The start Function may
        have missed it, or it was uploaded before reviews existed.
      </Text>
      <Button
        text="Start review"
        mode="ghost"
        disabled={pending}
        onClick={() =>
          run(() => startImageReview(engine, SANITY_TARGET, imageId))
        }
      />
      {failure ? <Notice tone="critical">{failure}</Notice> : null}
    </Stack>
  );
}

/** One commit at a time, with its failure kept on screen until the next attempt. */
function useCommit() {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  async function run(commit: () => Promise<unknown>) {
    setPending(true);
    setFailure(null);
    try {
      await commit();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  const start = (commit: () => Promise<unknown>) => void run(commit);
  return { pending, failure, run: start };
}

function Notice({
  tone,
  children,
}: {
  tone: "critical" | "caution";
  children: ReactNode;
}) {
  return (
    <Card padding={3} radius={2} tone={tone} border role="alert">
      <Text size={1}>{children}</Text>
    </Card>
  );
}

function Loading() {
  return (
    <Flex justify="center" padding={4}>
      <Spinner muted />
    </Flex>
  );
}
