"use client";

import { useImageHosts } from "./use-image-hosts";

export function NetworkProof() {
  const { hosts, appOriginCount, optimizerCount } = useImageHosts();
  const isClean =
    hosts.length > 0 && appOriginCount === 0 && optimizerCount === 0;

  return (
    <aside className="network-proof" aria-labelledby="network-proof-title">
      <h2 id="network-proof-title" className="eyebrow">
        Image requests from this tab
      </h2>
      {hosts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No image requests yet.</p>
      ) : (
        <ul className="network-hosts">
          {hosts.map((entry) => (
            <li
              key={entry.host}
              data-app-origin={entry.isAppOrigin || undefined}
            >
              <span className="font-mono">{entry.host}</span>
              <span className="font-mono tabular-nums">{entry.count}</span>
            </li>
          ))}
        </ul>
      )}
      <p
        className="text-xs"
        data-clean={isClean || undefined}
        aria-live="polite"
      >
        {isClean
          ? "0 image requests to this app. 0 through /_next/image."
          : hosts.length > 0
            ? `${appOriginCount} image requests to this app, ${optimizerCount} through /_next/image.`
            : "Read from the browser's Resource Timing API, the same data DevTools shows."}
      </p>
    </aside>
  );
}
