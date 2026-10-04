import { Card, Stack, Text } from "@sanity/ui";

import { numeric } from "./styles";

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
}

export function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <Card padding={4} radius={3} shadow={1}>
      <Stack gap={3}>
        <Text size={1} muted weight="medium">
          {label}
        </Text>
        <Text size={4} weight="semibold" style={numeric}>
          {value}
        </Text>
        {hint && (
          <Text size={1} muted>
            {hint}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
