import { useSyncExternalStore } from "react";

import {
  EMPTY_IMAGE_HOST_SUMMARY,
  type ImageHostSummary,
  summarizeImageHosts,
} from "./summarize-image-hosts";

let summary = EMPTY_IMAGE_HOST_SUMMARY;

function recompute() {
  summary = summarizeImageHosts(
    performance.getEntriesByType("resource") as PerformanceResourceTiming[],
    window.location.origin,
  );
}

function subscribe(onChange: () => void) {
  if (typeof PerformanceObserver === "undefined") return () => {};
  const observer = new PerformanceObserver(() => {
    recompute();
    onChange();
  });
  observer.observe({ type: "resource", buffered: true });
  return () => observer.disconnect();
}

const getSnapshot = (): ImageHostSummary => summary;
const getServerSnapshot = (): ImageHostSummary => EMPTY_IMAGE_HOST_SUMMARY;

export function useImageHosts(): ImageHostSummary {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
