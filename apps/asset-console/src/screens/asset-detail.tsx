import { DOCUMENT_TYPES } from "@assetlake/core/contracts";
import type { SanityImageSource } from "@assetlake/core/url";
import { useDocumentProjection } from "@sanity/sdk-react";
import {
  Badge,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Stack,
  Text,
} from "@sanity/ui";
import type { ReactNode } from "react";

import { CopyUrl } from "../components/copy-url";
import { EmptyState } from "../components/empty-state";
import { PresetMatrix } from "../components/preset-matrix";
import { ScreenBoundary } from "../components/screen-boundary";
import { PanelSkeleton } from "../components/skeletons";
import { StatusBadge } from "../components/status-badge";
import { breakAll, imageFrame, numeric } from "../components/styles";
import { IMAGE_DETAIL_PROJECTION } from "../data/queries";
import type { ImageDetailRow } from "../data/types";
import { type ImageDetailModel, toImageDetail } from "../data/view-models";
import { usePresetVariants } from "../hooks/use-presets";

interface AssetDetailProps {
  imageId: string;
  onBack: () => void;
  backLabel: string;
}

export function AssetDetail({ imageId, onBack, backLabel }: AssetDetailProps) {
  return (
    <Stack gap={4}>
      <Button
        text={`Back to ${backLabel}`}
        mode="bleed"
        fontSize={1}
        onClick={onBack}
        style={{ justifySelf: "start" }}
      />
      <ScreenBoundary
        fallback={<PanelSkeleton height={480} />}
        resetKeys={[imageId]}
      >
        <DetailContent imageId={imageId} />
      </ScreenBoundary>
    </Stack>
  );
}

function DetailContent({ imageId }: { imageId: string }) {
  const { data } = useDocumentProjection<ImageDetailRow>({
    documentId: imageId,
    documentType: DOCUMENT_TYPES.image,
    projection: IMAGE_DETAIL_PROJECTION,
  });

  if (!data)
    return (
      <EmptyState
        title="This asset no longer exists"
        description="It was deleted after you opened it. The list screens already reflect that."
      />
    );

  const image = toImageDetail(data);
  return (
    <Stack gap={5}>
      <Grid gridTemplateColumns={[1, 1, 2]} gap={4}>
        <OriginalPreview image={image} />
        <Metadata image={image} />
      </Grid>
      {image.source ? (
        <PresetSection source={image.source} />
      ) : (
        <EmptyState
          title="No preset previews"
          description="The record no longer references a Sanity image asset, so there is nothing to transform."
        />
      )}
    </Stack>
  );
}

function OriginalPreview({ image }: { image: ImageDetailModel }) {
  return (
    <Card padding={4} radius={3} shadow={1}>
      <Stack gap={4}>
        <Text size={1} weight="semibold">
          Original
        </Text>
        {image.originalUrl ? (
          <img
            src={image.originalUrl}
            alt={image.altText}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            decoding="async"
            style={{
              ...imageFrame,
              maxHeight: 420,
              width: "auto",
              margin: "0 auto",
            }}
          />
        ) : (
          <Text size={1} muted>
            The Sanity asset is missing.
          </Text>
        )}
        {image.lqip && (
          <Flex align="center" gap={3}>
            <img
              src={image.lqip}
              alt="Low quality placeholder"
              width={64}
              height={Math.round(
                64 * ((image.height ?? 1) / (image.width ?? 1)),
              )}
              style={{ ...imageFrame, width: 64 }}
            />
            <Text size={1} muted>
              LQIP placeholder, shown while the full image loads.
            </Text>
          </Flex>
        )}
      </Stack>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size={0} muted weight="medium">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

const Value = ({ children }: { children: ReactNode }) => (
  <Text size={1} style={{ ...numeric, ...breakAll }}>
    {children}
  </Text>
);

function Metadata({ image }: { image: ImageDetailModel }) {
  return (
    <Card padding={4} radius={3} shadow={1}>
      <Stack gap={4}>
        <Flex justify="space-between" align="center" gap={3}>
          <Heading size={1} as="h2">
            {image.purposeLabel} image
          </Heading>
          <StatusBadge status={image.status} />
        </Flex>
        <Grid gridTemplateColumns={2} gap={4}>
          <Field label="Application">
            <Value>{image.applicationLabel}</Value>
          </Field>
          <Field label="Entity">
            <Value>{image.entityLabel}</Value>
          </Field>
          <Field label="Dimensions">
            <Value>{image.dimensionsLabel}</Value>
          </Field>
          <Field label="MIME type">
            <Value>{image.mimeLabel}</Value>
          </Field>
          <Field label="Size">
            <Value>
              {image.sizeLabel} ({image.exactSizeLabel})
            </Value>
          </Field>
          <Field label="Uploaded">
            <Value>{image.uploadedLabel}</Value>
          </Field>
          <Field label="Policy">
            <Value>{image.policyLabel}</Value>
          </Field>
          <Field label="Original filename">
            <Value>{image.filenameLabel}</Value>
          </Field>
        </Grid>
        <Field label="AssetLake document id">
          <Value>{image.id}</Value>
        </Field>
        <Field label="Sanity asset id">
          <Value>{image.assetId}</Value>
        </Field>
        {image.tags.length > 0 && (
          <Field label="Tags">
            <Flex gap={2} wrap="wrap">
              {image.tags.map((tag) => (
                <Badge key={tag} fontSize={0}>
                  {tag}
                </Badge>
              ))}
            </Flex>
          </Field>
        )}
        {image.originalUrl && (
          <Field label="Original CDN URL">
            <CopyUrl url={image.originalUrl} />
          </Field>
        )}
      </Stack>
    </Card>
  );
}

function PresetSection({ source }: { source: SanityImageSource }) {
  return (
    <Stack gap={4}>
      <Stack gap={2}>
        <Heading size={1} as="h2">
          Preset matrix
        </Heading>
        <Text size={1} muted>
          Every named preset applied to this image, including unpublished preset
          drafts. Each URL is a live Sanity CDN transform.
        </Text>
      </Stack>
      <ScreenBoundary fallback={<PanelSkeleton />}>
        <PresetVariants source={source} />
      </ScreenBoundary>
    </Stack>
  );
}

function PresetVariants({ source }: { source: SanityImageSource }) {
  const variants = usePresetVariants();
  if (variants.length === 0)
    return (
      <EmptyState
        title="No presets defined"
        description="Seed the presets with the sanity-schema seed script, then they appear here."
      />
    );
  return <PresetMatrix source={source} variants={variants} />;
}
