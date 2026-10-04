import { useCurrentUser } from "@sanity/sdk-react";
import {
  Avatar,
  Badge,
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Text,
} from "@sanity/ui";
import { Suspense, useState } from "react";

import { isProductionDataset } from "./data/config";
import {
  activeTab,
  assetRoute,
  INITIAL_ROUTE,
  type Route,
  TABS,
} from "./routes";
import { SANITY_TARGET } from "./sanity-target";
import { AssetDetail } from "./screens/asset-detail";
import { Assets } from "./screens/assets";
import { Overview } from "./screens/overview";
import { Presets } from "./screens/presets";

export function ConsoleShell() {
  const [route, setRoute] = useState<Route>(INITIAL_ROUTE);
  const current = activeTab(route);
  const openAsset = (imageId: string) => setRoute(assetRoute(imageId, route));

  return (
    <Card style={{ minHeight: "100vh" }}>
      <Container width={4} paddingX={[3, 4, 5]} paddingY={[4, 5]}>
        <Stack gap={5}>
          <Header />
          <TabList gap={1}>
            {TABS.map(({ screen, label }) => (
              <Tab
                key={screen}
                id={`tab-${screen}`}
                aria-controls={`panel-${screen}`}
                label={label}
                selected={current === screen}
                onClick={() => setRoute({ screen })}
              />
            ))}
          </TabList>
          <TabPanel id={`panel-${current}`} aria-labelledby={`tab-${current}`}>
            <Screen
              route={route}
              onOpenAsset={openAsset}
              onNavigate={setRoute}
            />
          </TabPanel>
        </Stack>
      </Container>
    </Card>
  );
}

function Screen({
  route,
  onOpenAsset,
  onNavigate,
}: {
  route: Route;
  onOpenAsset: (imageId: string) => void;
  onNavigate: (route: Route) => void;
}) {
  switch (route.screen) {
    case "overview": {
      return <Overview onOpenAsset={onOpenAsset} />;
    }
    case "assets": {
      return <Assets onOpenAsset={onOpenAsset} />;
    }
    case "presets": {
      return <Presets />;
    }
    case "asset": {
      const backLabel =
        TABS.find((tab) => tab.screen === route.from)?.label ?? "list";
      return (
        <AssetDetail
          key={route.imageId}
          imageId={route.imageId}
          backLabel={backLabel.toLowerCase()}
          onBack={() => onNavigate({ screen: route.from })}
        />
      );
    }
  }
}

function Header() {
  const { dataset, projectId } = SANITY_TARGET;
  return (
    <Flex justify="space-between" align="flex-start" gap={4} wrap="wrap">
      <Stack gap={3}>
        <Heading as="h1" size={3} style={{ textWrap: "balance" }}>
          AssetLake Console
        </Heading>
        <Text size={1} muted>
          Uploads, delivery presets and CDN URLs for AssetLake, straight from
          the Content Lake.
        </Text>
      </Stack>
      <Flex align="center" gap={3}>
        <LiveIndicator />
        <Badge
          tone={isProductionDataset(dataset) ? "caution" : "primary"}
          fontSize={1}
          title={`Project ${projectId}`}
        >
          Dataset: {dataset}
        </Badge>
        <Suspense fallback={<Avatar size={1} />}>
          <CurrentUserAvatar />
        </Suspense>
      </Flex>
    </Flex>
  );
}

function LiveIndicator() {
  return (
    <Flex
      align="center"
      gap={2}
      title="Lists update through the Live Content API, without polling"
    >
      <Box
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#2fb170",
          boxShadow: "0 0 0 3px rgb(47 177 112 / 0.2)",
        }}
      />
      <Text size={1} muted>
        Live
      </Text>
    </Flex>
  );
}

function CurrentUserAvatar() {
  const user = useCurrentUser();
  return (
    <Avatar
      size={1}
      src={user?.profileImage}
      initials={user?.name?.slice(0, 1)}
      title={user?.name ?? "Signed in"}
    />
  );
}
