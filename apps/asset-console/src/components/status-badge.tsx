import type { ImageStatus } from "@assetlake/core/contracts";
import { Badge, type BadgeTone } from "@sanity/ui";

import { formatLabel } from "../data/format";

export const STATUS_TONES: Record<ImageStatus, BadgeTone> = {
  processing: "primary",
  ready: "positive",
  review: "caution",
  rejected: "critical",
  failed: "critical",
};

const toneFor = (status: string | null): BadgeTone =>
  status && status in STATUS_TONES
    ? STATUS_TONES[status as ImageStatus]
    : "default";

export function StatusBadge({ status }: { status: string | null }) {
  return (
    <Badge tone={toneFor(status)} fontSize={1}>
      {formatLabel(status)}
    </Badge>
  );
}
