import { Button, Flex, Stack, Text, TextInput } from "@sanity/ui";
import { useToast } from "@sanity/ui/toast";
import { useState } from "react";

import { breakAll } from "./styles";

const selectOnMount = (node: HTMLInputElement | null) => node?.select();

/**
 * The Dashboard renders the app in an iframe, which can deny clipboard writes. When it does, the
 * URL is shown pre-selected so the operator can copy it by hand.
 */
export function CopyUrl({ url }: { url: string }) {
  const toast = useToast();
  const [copyBlocked, setCopyBlocked] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyBlocked(false);
      toast.push({ status: "success", title: "URL copied" });
    } catch {
      setCopyBlocked(true);
      toast.push({
        status: "warning",
        title: "The Dashboard frame blocked the clipboard",
        description: "The URL is selected below. Press Cmd+C or Ctrl+C.",
      });
    }
  }

  return (
    <Stack gap={2}>
      <Text size={1} muted style={breakAll}>
        {url}
      </Text>
      <Flex gap={2}>
        <Button
          text="Copy URL"
          mode="ghost"
          fontSize={1}
          onClick={() => void copy()}
        />
        <Button
          as="a"
          href={url}
          target="_blank"
          rel="noreferrer"
          text="Open"
          mode="bleed"
          fontSize={1}
        />
      </Flex>
      {copyBlocked && (
        <TextInput
          readOnly
          value={url}
          fontSize={1}
          aria-label="URL to copy"
          ref={selectOnMount}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </Stack>
  );
}
