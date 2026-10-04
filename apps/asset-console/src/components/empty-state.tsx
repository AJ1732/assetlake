import { Button, Card, Stack, Text } from "@sanity/ui";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card padding={5} radius={3} tone="transparent" border>
      <Stack gap={4} style={{ maxWidth: 460, marginInline: "auto" }}>
        <Text size={2} weight="semibold" align="center">
          {title}
        </Text>
        <Text size={1} muted align="center">
          {description}
        </Text>
        {action && (
          <Button
            text={action.label}
            mode="ghost"
            onClick={action.onClick}
            style={{ justifySelf: "center" }}
          />
        )}
      </Stack>
    </Card>
  );
}
