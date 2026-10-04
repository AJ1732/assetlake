import { Card, type CardTone, Flex, Grid, Stack, Text } from "@sanity/ui";

import { BreakdownBars } from "../components/breakdown-bars";
import { EmptyState } from "../components/empty-state";
import { ImageThumb } from "../components/image-thumb";
import { ScreenBoundary } from "../components/screen-boundary";
import { PanelSkeleton, TileRowSkeleton } from "../components/skeletons";
import { StatTile } from "../components/stat-tile";
import { STATUS_TONES, StatusBadge } from "../components/status-badge";
import { numeric } from "../components/styles";
import {
  ORIGINAL_BYTES_LABEL,
  RECENT_UPLOADS_LIMIT,
  summarize,
} from "../data/aggregate";
import { formatBytes } from "../data/format";
import { thumbnailTransform } from "../data/preset-transform";
import type { ImageRow } from "../data/types";
import { toImageCard } from "../data/view-models";
import { useImageList } from "../hooks/use-image-list";
import { usePresetVariants } from "../hooks/use-presets";

interface OverviewProps {
  onOpenAsset: (imageId: string) => void;
}

export function Overview({ onOpenAsset }: OverviewProps) {
  return (
    <ScreenBoundary
      fallback={
        <Stack gap={4}>
          <TileRowSkeleton />
          <PanelSkeleton />
        </Stack>
      }
    >
      <OverviewContent onOpenAsset={onOpenAsset} />
    </ScreenBoundary>
  );
}

const statusTone = (key: string): CardTone =>
  STATUS_TONES[key as keyof typeof STATUS_TONES] ?? "default";

function OverviewContent({ onOpenAsset }: OverviewProps) {
  const summary = summarize(useImageList());

  if (summary.total === 0)
    return (
      <EmptyState
        title="No uploads yet"
        description="Upload an image from the demo app. It appears here within a second or two, with no reload."
      />
    );

  const listedHint =
    summary.listed < summary.total
      ? `Covers the ${summary.listed} newest of ${summary.total} records.`
      : `Across ${summary.listed} records.`;

  return (
    <Stack gap={4}>
      <Grid gridTemplateColumns={[1, 1, 3]} gap={3}>
        <StatTile label="Image records" value={String(summary.total)} />
        <StatTile
          label={ORIGINAL_BYTES_LABEL}
          value={formatBytes(summary.originalBytes)}
          hint={listedHint}
        />
        <StatTile
          label="Ready for delivery"
          value={String(
            summary.byStatus.find((bucket) => bucket.key === "ready")?.count ??
              0,
          )}
          hint="Status ready, served by the demo app."
        />
      </Grid>
      <Grid gridTemplateColumns={[1, 1, 2]} gap={3}>
        <BreakdownBars
          title="By status"
          buckets={summary.byStatus}
          total={summary.listed}
          toneFor={statusTone}
        />
        <BreakdownBars
          title="By purpose"
          buckets={summary.byPurpose}
          total={summary.listed}
        />
      </Grid>
      <RecentUploads rows={summary.recent} onOpenAsset={onOpenAsset} />
    </Stack>
  );
}

function RecentUploads({
  rows,
  onOpenAsset,
}: {
  rows: ImageRow[];
  onOpenAsset: OverviewProps["onOpenAsset"];
}) {
  const { transform } = thumbnailTransform(usePresetVariants());
  return (
    <Card padding={4} radius={3} shadow={1}>
      <Stack gap={4}>
        <Text size={1} weight="semibold">
          {RECENT_UPLOADS_LIMIT} most recent uploads
        </Text>
        <Stack
          gap={2}
          as="ul"
          style={{ margin: 0, padding: 0, listStyle: "none" }}
        >
          {rows.map((row) => {
            const image = toImageCard(row);
            return (
              <li key={row.id}>
                <Card
                  as="button"
                  type="button"
                  padding={2}
                  radius={2}
                  onClick={() => onOpenAsset(row.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <Flex align="center" gap={3}>
                    <ImageThumb
                      source={image.source}
                      transform={transform}
                      lqip={image.lqip}
                      alt={image.altText}
                      size={40}
                    />
                    <Stack gap={2} flex={1} style={{ minWidth: 0 }}>
                      <Text size={1} weight="medium" textOverflow="ellipsis">
                        {image.purposeLabel} · {image.applicationLabel}
                      </Text>
                      <Text size={0} muted style={numeric}>
                        {image.uploadedLabel} · {image.sizeLabel}
                      </Text>
                    </Stack>
                    <StatusBadge status={image.status} />
                  </Flex>
                </Card>
              </li>
            );
          })}
        </Stack>
      </Stack>
    </Card>
  );
}
