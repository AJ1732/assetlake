import { Button, Card, Stack, Text } from "@sanity/ui";
import { type ReactNode, Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

interface ScreenBoundaryProps {
  /** Sized like the loaded content so the screen does not jump when data arrives. */
  fallback: ReactNode;
  children: ReactNode;
  /** Values that should clear a previous error, such as the id of the document on screen. */
  resetKeys?: unknown[];
}

/** Every SDK data hook suspends while loading and throws on failure; this gives both a home. */
export function ScreenBoundary({
  fallback,
  children,
  resetKeys,
}: ScreenBoundaryProps) {
  return (
    <ErrorBoundary FallbackComponent={LoadError} resetKeys={resetKeys}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

function LoadError({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <Card padding={4} radius={3} tone="critical" border role="alert">
      <Stack gap={4}>
        <Text size={2} weight="semibold">
          Could not load this data
        </Text>
        <Text size={1}>{messageOf(error)}</Text>
        <Button
          text="Try again"
          mode="ghost"
          tone="critical"
          onClick={resetErrorBoundary}
          style={{ justifySelf: "start" }}
        />
      </Stack>
    </Card>
  );
}
