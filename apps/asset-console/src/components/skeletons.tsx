import { Card, Grid, Skeleton, Stack, TextSkeleton } from "@sanity/ui";

export function TileRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Grid gridTemplateColumns={[1, 1, count]} gap={3}>
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} padding={4} radius={3} shadow={1}>
          <Stack gap={3}>
            <TextSkeleton size={1} animated style={{ width: "40%" }} />
            <TextSkeleton size={4} animated style={{ width: "60%" }} />
          </Stack>
        </Card>
      ))}
    </Grid>
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <Grid gridTemplateColumns={[1, 2, 3, 4]} gap={3}>
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} padding={3} radius={3} shadow={1}>
          <Stack gap={3}>
            <Skeleton animated radius={2} style={{ height: 96, width: 96 }} />
            <TextSkeleton size={1} animated style={{ width: "70%" }} />
            <TextSkeleton size={1} animated style={{ width: "50%" }} />
          </Stack>
        </Card>
      ))}
    </Grid>
  );
}

export function PanelSkeleton({ height = 320 }: { height?: number }) {
  return <Skeleton animated radius={3} style={{ height }} />;
}
