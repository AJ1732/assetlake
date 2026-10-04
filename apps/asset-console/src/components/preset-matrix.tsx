import type { SanityImageSource } from "@assetlake/core/url";
import { Badge, Card, Flex, Grid, Stack, Text } from "@sanity/ui";

import {
  describeTransform,
  type PresetVariant,
} from "../data/preset-transform";
import { imageUrls } from "../sanity-target";
import { CopyUrl } from "./copy-url";
import { imageFrame } from "./styles";

const PREVIEW_MAX_HEIGHT = 220;

interface PresetMatrixProps {
  source: SanityImageSource;
  variants: PresetVariant[];
}

export function PresetMatrix({ source, variants }: PresetMatrixProps) {
  return (
    <Grid gridTemplateColumns={[1, 1, 2]} gap={3}>
      {variants.map((variant) => (
        <PresetTile key={variant.id} source={source} variant={variant} />
      ))}
    </Grid>
  );
}

export function PresetTile({
  source,
  variant,
}: {
  source: SanityImageSource;
  variant: PresetVariant;
}) {
  const url = imageUrls.buildUrl(source, variant.transform);
  const { width, height } = variant.transform;
  return (
    <Card padding={4} radius={3} shadow={1}>
      <Stack gap={4}>
        <Flex justify="space-between" align="center" gap={2}>
          <Stack gap={2}>
            <Text size={1} weight="semibold">
              {variant.name}
            </Text>
            <Text size={0} muted>
              {variant.slug}
            </Text>
          </Stack>
          <Badge
            tone={variant.issues.length > 0 ? "caution" : "primary"}
            fontSize={0}
          >
            {describeTransform(variant.transform) || "No transform"}
          </Badge>
        </Flex>
        {variant.issues.length > 0 && (
          <Card padding={3} radius={2} tone="caution" border>
            <Text size={1}>
              Core rejects this preset until fixed:{" "}
              {variant.issues.map((issue) => issue.message).join("; ")}. The
              preview leaves those fields out.
            </Text>
          </Card>
        )}
        <Card
          radius={2}
          tone="transparent"
          padding={2}
          style={{ display: "grid", placeItems: "center" }}
        >
          <img
            key={url}
            src={url}
            alt={`${variant.name} rendition`}
            loading="lazy"
            decoding="async"
            width={width}
            height={height}
            style={{
              ...imageFrame,
              maxHeight: PREVIEW_MAX_HEIGHT,
              width: "auto",
              objectFit: "contain",
            }}
          />
        </Card>
        <CopyUrl url={url} />
      </Stack>
    </Card>
  );
}
