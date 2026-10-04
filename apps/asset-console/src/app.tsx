import { SanityApp, type SanityConfig } from "@sanity/sdk-react";
import { Flex, Spinner } from "@sanity/ui";

import { ConsoleShell } from "./console-shell";
import { SANITY_TARGET } from "./sanity-target";
import { SanityUI } from "./sanity-ui";

// No token here: inside the Dashboard the App SDK authenticates as the signed-in user.
const SANITY_CONFIG: SanityConfig[] = [SANITY_TARGET];

function Loading() {
  return (
    <Flex justify="center" align="center" style={{ minHeight: "100vh" }}>
      <Spinner muted />
    </Flex>
  );
}

export default function App() {
  return (
    <SanityUI>
      <SanityApp config={SANITY_CONFIG} fallback={<Loading />}>
        <ConsoleShell />
      </SanityApp>
    </SanityUI>
  );
}
