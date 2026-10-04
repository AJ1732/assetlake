import type { SanityImageSource } from "@assetlake/core/url";
import { DOCUMENT_TYPES } from "@assetlake/sanity-schema/constants";
import {
  discardDocument,
  type DocumentAction,
  type DocumentHandle,
  publishDocument,
  useApplyDocumentActions,
  useDocument,
  useEditDocument,
} from "@sanity/sdk-react";
import {
  Badge,
  Button,
  Card,
  Flex,
  Grid,
  Select,
  Stack,
  Text,
  TextInput,
} from "@sanity/ui";
import { useToast } from "@sanity/ui/toast";
import { Suspense, useMemo, useState, useTransition } from "react";

import { EmptyState } from "../components/empty-state";
import { PresetTile } from "../components/preset-matrix";
import { ScreenBoundary } from "../components/screen-boundary";
import { PanelSkeleton } from "../components/skeletons";
import { describeChange, draftRow, presetChanges } from "../data/preset-diff";
import {
  type NumericPresetField,
  parsePresetInput,
  toPresetVariant,
  type TransformIssue,
  withPresetField,
} from "../data/preset-transform";
import type { ImageRow, PresetDocument, PresetRow } from "../data/types";
import { pickExampleImage, toImageCard } from "../data/view-models";
import { useImageList } from "../hooks/use-image-list";
import { usePresetRows } from "../hooks/use-presets";

export const DELIVERY_NOTE = "Applies to delivery within ~60s of publishing.";

export function Presets() {
  const [exampleId, setExampleId] = useState<string | null>(null);
  return (
    <Stack gap={4}>
      <Card padding={4} radius={3} tone="primary" border>
        <Stack gap={3}>
          <Text size={1} weight="semibold">
            How preset edits reach delivery
          </Text>
          <Text size={1}>
            Edits save as a draft and update the previews here immediately. The
            demo app only reads published presets. Publish to apply a change.{" "}
            {DELIVERY_NOTE}
          </Text>
        </Stack>
      </Card>
      <ScreenBoundary fallback={<PanelSkeleton height={520} />}>
        <PresetsContent exampleId={exampleId} onExampleChange={setExampleId} />
      </ScreenBoundary>
    </Stack>
  );
}

function PresetsContent({
  exampleId,
  onExampleChange,
}: {
  exampleId: string | null;
  onExampleChange: (imageId: string) => void;
}) {
  const { items } = useImageList();
  const example = pickExampleImage(items, exampleId);
  return (
    <Stack gap={4}>
      {example ? (
        <ExamplePicker
          rows={items}
          selectedId={example.id}
          onChange={onExampleChange}
        />
      ) : (
        <Card padding={3} radius={3} tone="caution" border>
          <Text size={1}>
            No uploaded image to preview with yet. Presets are still editable;
            previews appear after the first upload.
          </Text>
        </Card>
      )}
      <PublishedPresets source={example?.source ?? null} />
    </Stack>
  );
}

function ExamplePicker({
  rows,
  selectedId,
  onChange,
}: {
  rows: ImageRow[];
  selectedId: string;
  onChange: (imageId: string) => void;
}) {
  const options = rows
    .map((row) => toImageCard(row))
    .filter((image) => image.source !== null);
  return (
    <Stack gap={2} style={{ maxWidth: 480 }}>
      <Text as="label" htmlFor="example-image" size={1} weight="medium">
        Example image
      </Text>
      <Select
        id="example-image"
        fontSize={1}
        value={selectedId}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((image) => (
          <option key={image.id} value={image.id}>
            {image.purposeLabel} · {image.applicationLabel} ·{" "}
            {image.uploadedLabel}
          </option>
        ))}
      </Select>
    </Stack>
  );
}

/** Rows come from the published perspective: that is what core delivers, so it anchors the diff. */
function PublishedPresets({ source }: { source: SanityImageSource | null }) {
  const published = usePresetRows("published");
  if (published.length === 0)
    return (
      <EmptyState
        title="No published presets"
        description="Seed the presets with the sanity-schema seed script, then they appear here."
      />
    );
  return (
    <Stack gap={4}>
      {published.map((row) => (
        <Suspense key={row.id} fallback={<PanelSkeleton height={280} />}>
          <PresetEditor published={row} source={source} />
        </Suspense>
      ))}
    </Stack>
  );
}

const EDITABLE_FIELDS: ReadonlyArray<{
  field: NumericPresetField;
  label: string;
  hint: string;
}> = [
  { field: "quality", label: "Quality", hint: "1 to 100" },
  { field: "width", label: "Width (px)", hint: "Whole pixels" },
];

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

function PresetEditor({
  published,
  source,
}: {
  published: PresetRow;
  source: SanityImageSource | null;
}) {
  const handle = useMemo<DocumentHandle>(
    () => ({ documentId: published.id, documentType: DOCUMENT_TYPES.preset }),
    [published.id],
  );
  // useDocument is local-first: an edit re-renders this preview before the server round trip.
  const { data: draft } = useDocument<PresetDocument>(handle);
  const edit = useEditDocument<PresetDocument>(handle);
  const apply = useApplyDocumentActions();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  if (!draft)
    return (
      <EmptyState
        title={`${published.name ?? published.id} was deleted`}
        description="Another editor removed this preset."
      />
    );

  const variant = toPresetVariant(draftRow(published, draft));
  const changes = presetChanges(draft, published);
  const hasChanges = changes.length > 0;
  const hasIssues = variant.issues.length > 0;

  function updateField(field: NumericPresetField, raw: string) {
    edit((current) =>
      withPresetField(current, field, parsePresetInput(raw)),
    ).catch((error: unknown) =>
      toast.push({
        status: "error",
        title: "Could not save the draft",
        description: messageOf(error),
      }),
    );
  }

  function runAction(
    action: DocumentAction,
    success: { title: string; description?: string },
    failureTitle: string,
  ) {
    startTransition(async () => {
      try {
        const result = await apply(action);
        await result.submitted();
        toast.push({ status: "success", ...success });
      } catch (error) {
        toast.push({
          status: "error",
          title: failureTitle,
          description: messageOf(error),
        });
      }
    });
  }

  const publish = () =>
    runAction(
      publishDocument(handle),
      { title: `${variant.name} published`, description: DELIVERY_NOTE },
      `Could not publish ${variant.name}`,
    );
  const discard = () =>
    runAction(
      discardDocument(handle),
      { title: `${variant.name} draft discarded` },
      `Could not discard the ${variant.name} draft`,
    );

  return (
    <Card padding={4} radius={3} shadow={1}>
      <Grid gridTemplateColumns={[1, 1, 2]} gap={5}>
        <Stack gap={4}>
          <Flex justify="space-between" align="center" gap={3}>
            <Stack gap={2}>
              <Text size={2} weight="semibold">
                {variant.name}
              </Text>
              <Text size={1} muted>
                {variant.slug}
              </Text>
            </Stack>
            <Badge tone={hasChanges ? "caution" : "positive"} fontSize={1}>
              {hasChanges ? "Unpublished changes" : "Published"}
            </Badge>
          </Flex>
          <Grid gridTemplateColumns={2} gap={3}>
            {EDITABLE_FIELDS.map(({ field, label, hint }) => (
              <NumberField
                key={field}
                id={`${published.id}-${field}`}
                label={label}
                hint={hint}
                value={draft[field]}
                issue={variant.issues.find((issue) => issue.field === field)}
                onChange={(raw) => updateField(field, raw)}
              />
            ))}
          </Grid>
          {hasChanges && (
            <Card padding={3} radius={2} tone="caution" border>
              <Stack gap={2}>
                <Text size={1} weight="medium">
                  Draft differs from what delivery serves:
                </Text>
                {changes.map((change) => (
                  <Text key={change.field} size={1}>
                    {describeChange(change)}
                  </Text>
                ))}
              </Stack>
            </Card>
          )}
          <Flex gap={2} align="center" wrap="wrap">
            <Button
              text="Publish"
              tone="positive"
              disabled={!hasChanges || hasIssues || isPending}
              loading={isPending}
              onClick={publish}
            />
            <Button
              text="Discard draft"
              mode="ghost"
              disabled={!hasChanges || isPending}
              onClick={discard}
            />
            <Text size={1} muted>
              {hasIssues
                ? "Fix the highlighted fields before publishing."
                : DELIVERY_NOTE}
            </Text>
          </Flex>
        </Stack>
        {source ? (
          <PresetTile source={source} variant={variant} />
        ) : (
          <Card padding={4} radius={3} tone="transparent" border>
            <Text size={1} muted>
              Preview appears after the first upload.
            </Text>
          </Card>
        )}
      </Grid>
    </Card>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  hint: string;
  value: number | null | undefined;
  issue: TransformIssue | undefined;
  onChange: (raw: string) => void;
}

function NumberField({
  id,
  label,
  hint,
  value,
  issue,
  onChange,
}: NumberFieldProps) {
  return (
    <Stack gap={2}>
      <Text as="label" htmlFor={id} size={1} weight="medium">
        {label}
      </Text>
      <TextInput
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        fontSize={1}
        value={value ?? ""}
        customValidity={issue?.message}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <Text id={`${id}-hint`} size={0} muted>
        {issue?.message ?? hint}
      </Text>
    </Stack>
  );
}
