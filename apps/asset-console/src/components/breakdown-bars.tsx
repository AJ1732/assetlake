import { Card, type CardTone, Flex, Stack, Text } from "@sanity/ui";

import { type Bucket, shareOfTotal } from "../data/aggregate";
import { formatLabel } from "../data/format";
import { numeric } from "./styles";

interface BreakdownBarsProps {
  title: string;
  buckets: Bucket[];
  total: number;
  toneFor?: (key: string) => CardTone;
}

export function BreakdownBars({
  title,
  buckets,
  total,
  toneFor = () => "primary",
}: BreakdownBarsProps) {
  return (
    <Card padding={4} radius={3} shadow={1}>
      <Stack gap={4}>
        <Text size={1} weight="semibold">
          {title}
        </Text>
        <Stack
          gap={3}
          as="ul"
          style={{ margin: 0, padding: 0, listStyle: "none" }}
        >
          {buckets.map(({ key, count }) => {
            const share = shareOfTotal(count, total);
            return (
              <Stack as="li" key={key} gap={2}>
                <Flex justify="space-between">
                  <Text size={1}>{formatLabel(key)}</Text>
                  <Text size={1} muted style={numeric}>
                    {count}
                  </Text>
                </Flex>
                <Card
                  radius={2}
                  tone="transparent"
                  border
                  aria-hidden
                  style={{ height: 8, overflow: "hidden" }}
                >
                  <Card
                    tone={toneFor(key)}
                    border
                    style={{
                      height: "100%",
                      width: `${share}%`,
                      transitionProperty: "width",
                      transitionDuration: "300ms",
                      transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
                    }}
                  />
                </Card>
              </Stack>
            );
          })}
        </Stack>
      </Stack>
    </Card>
  );
}
