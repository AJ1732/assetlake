import { IMAGE_PURPOSES, IMAGE_STATUSES } from "@assetlake/core/contracts";
import { Button, Card, Flex, Grid, Select, Stack, Text } from "@sanity/ui";
import { useState } from "react";

import { EmptyState } from "../components/empty-state";
import { ImageCard } from "../components/image-card";
import { ScreenBoundary } from "../components/screen-boundary";
import { CardGridSkeleton } from "../components/skeletons";
import { numeric } from "../components/styles";
import {
  applicationOptions,
  filterImages,
  hasActiveFilters,
  type ImageFilters,
  NO_FILTERS,
} from "../data/filters";
import { formatLabel } from "../data/format";
import { thumbnailTransform } from "../data/preset-transform";
import type { ImageRow } from "../data/types";
import { toImageCard } from "../data/view-models";
import { useImageList } from "../hooks/use-image-list";
import { usePresetVariants } from "../hooks/use-presets";

interface AssetsProps {
  onOpenAsset: (imageId: string) => void;
}

export function Assets({ onOpenAsset }: AssetsProps) {
  const [filters, setFilters] = useState<ImageFilters>(NO_FILTERS);
  return (
    <ScreenBoundary fallback={<CardGridSkeleton />}>
      <AssetsContent
        filters={filters}
        onFiltersChange={setFilters}
        onOpenAsset={onOpenAsset}
      />
    </ScreenBoundary>
  );
}

interface AssetsContentProps extends AssetsProps {
  filters: ImageFilters;
  onFiltersChange: (filters: ImageFilters) => void;
}

function AssetsContent({
  filters,
  onFiltersChange,
  onOpenAsset,
}: AssetsContentProps) {
  const { items } = useImageList();

  if (items.length === 0)
    return (
      <EmptyState
        title="No assets yet"
        description="Images uploaded through the demo app appear here live, with their delivery thumbnails."
      />
    );

  const visible = filterImages(items, filters);
  const clearFilters = () => onFiltersChange(NO_FILTERS);

  return (
    <Stack gap={4}>
      <FilterBar
        filters={filters}
        applications={applicationOptions(items)}
        onChange={onFiltersChange}
        onClear={clearFilters}
        shown={visible.length}
        listed={items.length}
      />
      {visible.length === 0 ? (
        <EmptyState
          title="No assets match these filters"
          description="Try a different application, purpose or status."
          action={{ label: "Clear filters", onClick: clearFilters }}
        />
      ) : (
        <AssetGrid rows={visible} onOpenAsset={onOpenAsset} />
      )}
    </Stack>
  );
}

function AssetGrid({
  rows,
  onOpenAsset,
}: {
  rows: ImageRow[];
  onOpenAsset: AssetsProps["onOpenAsset"];
}) {
  const { transform } = thumbnailTransform(usePresetVariants());
  return (
    <Grid gridTemplateColumns={[1, 2, 3, 4]} gap={3}>
      {rows.map((row) => (
        <ImageCard
          key={row.id}
          image={toImageCard(row)}
          thumbnail={transform}
          onOpen={onOpenAsset}
        />
      ))}
    </Grid>
  );
}

const ALL = "";
const fromSelect = (value: string) => (value === ALL ? null : value);

interface FilterBarProps {
  filters: ImageFilters;
  applications: { id: string; name: string }[];
  onChange: (filters: ImageFilters) => void;
  onClear: () => void;
  shown: number;
  listed: number;
}

function FilterBar({
  filters,
  applications,
  onChange,
  onClear,
  shown,
  listed,
}: FilterBarProps) {
  return (
    <Card padding={3} radius={3} shadow={1}>
      <Flex gap={3} align="flex-end" wrap="wrap">
        <FilterSelect
          label="Application"
          value={filters.applicationId}
          options={applications.map(({ id, name }) => ({
            value: id,
            label: name,
          }))}
          onChange={(applicationId) => onChange({ ...filters, applicationId })}
        />
        <FilterSelect
          label="Purpose"
          value={filters.purpose}
          options={IMAGE_PURPOSES.map((value) => ({
            value,
            label: formatLabel(value),
          }))}
          onChange={(purpose) => onChange({ ...filters, purpose })}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          options={IMAGE_STATUSES.map((value) => ({
            value,
            label: formatLabel(value),
          }))}
          onChange={(status) => onChange({ ...filters, status })}
        />
        <Flex flex={1} justify="flex-end" align="center" gap={3}>
          <Text size={1} muted style={numeric} aria-live="polite">
            {shown} of {listed}
          </Text>
          <Button
            text="Clear filters"
            mode="bleed"
            fontSize={1}
            disabled={!hasActiveFilters(filters)}
            onClick={onClear}
          />
        </Flex>
      </Flex>
    </Card>
  );
}

interface FilterSelectProps {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <Stack gap={2} style={{ minWidth: 160 }}>
      <Text as="label" htmlFor={id} size={1} weight="medium">
        {label}
      </Text>
      <Select
        id={id}
        fontSize={1}
        value={value ?? ALL}
        onChange={(event) => onChange(fromSelect(event.currentTarget.value))}
      >
        <option value={ALL}>All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Stack>
  );
}
