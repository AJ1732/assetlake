import { Button, Card, Flex, Grid, Stack, Text } from "@sanity/ui";
import { useState } from "react";

import { EmptyState } from "../components/empty-state";
import { ImageThumb } from "../components/image-thumb";
import { ReviewPanel } from "../components/review-panel";
import { ScreenBoundary } from "../components/screen-boundary";
import { PanelSkeleton } from "../components/skeletons";
import { StatusBadge } from "../components/status-badge";
import { thumbnailTransform } from "../data/preset-transform";
import {
  CONFIDENTIALITY_NOTICE,
  pickQueuedRow,
} from "../data/review-view-models";
import type { ImageRow } from "../data/types";
import { toImageCard } from "../data/view-models";
import { usePresetVariants } from "../hooks/use-presets";
import { useReviewQueue } from "../hooks/use-review";

interface ReviewQueueProps {
  onOpenAsset: (imageId: string) => void;
}

export function ReviewQueue({ onOpenAsset }: ReviewQueueProps) {
  return (
    <Stack gap={4}>
      <Card padding={3} radius={3} tone="caution" border>
        <Text size={1}>{CONFIDENTIALITY_NOTICE}</Text>
      </Card>
      <ScreenBoundary fallback={<PanelSkeleton />}>
        <ReviewQueueContent onOpenAsset={onOpenAsset} />
      </ScreenBoundary>
    </Stack>
  );
}

function ReviewQueueContent({ onOpenAsset }: ReviewQueueProps) {
  const { pending, rejected } = useReviewQueue();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const selected = pickQueuedRow(pending, chosenId);

  return (
    <Stack gap={5}>
      {selected ? (
        <Grid gridTemplateColumns={[1, 1, 2]} gap={4}>
          <QueueList
            rows={pending}
            selectedId={selected.id}
            onSelect={setChosenId}
          />
          <Card padding={4} radius={3} border>
            <Stack gap={4}>
              <SelectedImage row={selected} onOpenAsset={onOpenAsset} />
              <ReviewPanel key={selected.id} imageId={selected.id} />
            </Stack>
          </Card>
        </Grid>
      ) : (
        <EmptyState
          title="Nothing waiting for review"
          description="Uploads under a policy that requires review appear here live. In the demo app, tick Hold for review before uploading."
        />
      )}
      {rejected.length > 0 ? (
        <RecentlyRejected rows={rejected} onOpenAsset={onOpenAsset} />
      ) : null}
    </Stack>
  );
}

function QueueList({
  rows,
  selectedId,
  onSelect,
}: {
  rows: ImageRow[];
  selectedId: string;
  onSelect: (imageId: string) => void;
}) {
  const { transform } = thumbnailTransform(usePresetVariants());
  return (
    <Stack gap={2} as="ul" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {rows.map((row) => {
        const card = toImageCard(row);
        return (
          <li key={row.id}>
            <Card
              as="button"
              padding={2}
              radius={2}
              border
              selected={row.id === selectedId}
              aria-current={row.id === selectedId || undefined}
              onClick={() => onSelect(row.id)}
              style={{ width: "100%", textAlign: "left" }}
            >
              <Flex gap={3} align="center">
                <ImageThumb
                  source={card.source}
                  transform={transform}
                  lqip={card.lqip}
                  alt={card.altText}
                  size={56}
                />
                <Stack gap={2}>
                  <Text size={1} weight="medium">
                    {card.purposeLabel} · {card.applicationLabel}
                  </Text>
                  <Text size={1} muted>
                    Uploaded {card.uploadedLabel}
                  </Text>
                </Stack>
              </Flex>
            </Card>
          </li>
        );
      })}
    </Stack>
  );
}

function SelectedImage({
  row,
  onOpenAsset,
}: {
  row: ImageRow;
  onOpenAsset: ReviewQueueProps["onOpenAsset"];
}) {
  const card = toImageCard(row);
  const { transform } = thumbnailTransform(usePresetVariants());
  return (
    <Flex gap={4} align="flex-start" wrap="wrap">
      <ImageThumb
        source={card.source}
        transform={transform}
        lqip={card.lqip}
        alt={card.altText}
        size={160}
      />
      <Stack gap={3}>
        <StatusBadge status={row.status} />
        <Text size={1}>
          {card.purposeLabel} for {card.applicationLabel}
        </Text>
        <Text size={1} muted>
          {card.dimensionsLabel} · {card.mimeLabel} · {card.sizeLabel}
        </Text>
        <Button
          text="Open asset details"
          mode="bleed"
          fontSize={1}
          onClick={() => onOpenAsset(row.id)}
        />
      </Stack>
    </Flex>
  );
}

function RecentlyRejected({
  rows,
  onOpenAsset,
}: {
  rows: ImageRow[];
  onOpenAsset: ReviewQueueProps["onOpenAsset"];
}) {
  return (
    <Stack gap={3}>
      <Text size={1} weight="semibold">
        Recently rejected (still public by URL)
      </Text>
      <Flex gap={2} wrap="wrap">
        {rows.map((row) => (
          <Button
            key={row.id}
            text={`${toImageCard(row).purposeLabel} · ${row.id.slice(-8)}`}
            mode="ghost"
            tone="critical"
            fontSize={1}
            onClick={() => onOpenAsset(row.id)}
          />
        ))}
      </Flex>
    </Stack>
  );
}
