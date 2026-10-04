export interface ResourceEntryLike {
  name: string;
  initiatorType: string;
}

export interface ImageHostCount {
  host: string;
  count: number;
  isAppOrigin: boolean;
}

export interface ImageHostSummary {
  hosts: ImageHostCount[];
  appOriginCount: number;
  optimizerCount: number;
}

export const EMPTY_IMAGE_HOST_SUMMARY: ImageHostSummary = {
  hosts: [],
  appOriginCount: 0,
  optimizerCount: 0,
};

const NEXT_IMAGE_OPTIMIZER_PATH = "/_next/image";

/**
 * Groups image requests by host. Static app assets (icons, the Next logo) still count against the
 * app origin on purpose: the claim is "zero image bytes from the app", so nothing gets filtered out.
 * blob: previews and data: placeholders never touch the network and are skipped.
 */
export function summarizeImageHosts(
  entries: readonly ResourceEntryLike[],
  appOrigin: string,
): ImageHostSummary {
  const counts = new Map<string, number>();
  let optimizerCount = 0;
  const appHost = new URL(appOrigin).host;

  for (const entry of entries) {
    if (entry.initiatorType !== "img") continue;
    let url: URL;
    try {
      url = new URL(entry.name);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (url.pathname.startsWith(NEXT_IMAGE_OPTIMIZER_PATH)) optimizerCount += 1;
    counts.set(url.host, (counts.get(url.host) ?? 0) + 1);
  }

  const hosts = [...counts.entries()]
    .map(([host, count]) => ({ host, count, isAppOrigin: host === appHost }))
    .sort(
      (left, right) =>
        right.count - left.count || left.host.localeCompare(right.host),
    );

  return {
    hosts,
    appOriginCount: counts.get(appHost) ?? 0,
    optimizerCount,
  };
}
