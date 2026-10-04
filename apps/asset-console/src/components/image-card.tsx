import type { ImageTransform } from "@assetlake/core/url";
import { Card, Flex, Stack, Text } from "@sanity/ui";

import type { ImageCardModel } from "../data/view-models";
import { ImageThumb } from "./image-thumb";
import { StatusBadge } from "./status-badge";
import { numeric } from "./styles";

interface ImageCardProps {
  image: ImageCardModel;
  thumbnail: ImageTransform;
  onOpen: (imageId: string) => void;
}

export function ImageCard({ image, thumbnail, onOpen }: ImageCardProps) {
  return (
    <Card
      as="button"
      type="button"
      padding={3}
      radius={3}
      shadow={1}
      onClick={() => onOpen(image.id)}
      aria-label={`Open ${image.purposeLabel} image from ${image.applicationLabel}`}
      style={{ textAlign: "left", cursor: "pointer", width: "100%" }}
    >
      <Stack gap={3}>
        <Flex gap={3} align="flex-start">
          <ImageThumb
            source={image.source}
            transform={thumbnail}
            lqip={image.lqip}
            alt={image.altText}
          />
          <Stack gap={2} flex={1} style={{ minWidth: 0 }}>
            <Flex justify="space-between" align="center" gap={2}>
              <Text size={1} weight="semibold" textOverflow="ellipsis">
                {image.purposeLabel}
              </Text>
              <StatusBadge status={image.status} />
            </Flex>
            <Text size={1} muted textOverflow="ellipsis">
              {image.applicationLabel}
            </Text>
            <Text size={1} muted style={numeric}>
              {image.dimensionsLabel}
            </Text>
          </Stack>
        </Flex>
        <Flex justify="space-between" gap={2}>
          <Text size={0} muted>
            {image.mimeLabel}
          </Text>
          <Text size={0} muted style={numeric}>
            {image.sizeLabel}
          </Text>
        </Flex>
        <Text size={0} muted style={numeric}>
          {image.uploadedLabel}
        </Text>
      </Stack>
    </Card>
  );
}
