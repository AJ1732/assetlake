"use client";

import { Button } from "@/components/ui/button";

export default function SiteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <section role="alert" className="panel error-panel">
      <p className="eyebrow">Something failed</p>
      <h1 className="display-title">This page could not load.</h1>
      <p className="text-muted-foreground">
        Sanity or the app backend did not answer as expected. Your images are
        unaffected; they are served by cdn.sanity.io, not by this app.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          Reference {error.digest}
        </p>
      ) : null}
      <Button
        type="button"
        onClick={() => unstable_retry()}
        className="h-10 w-fit px-4 text-sm"
      >
        Try again
      </Button>
    </section>
  );
}
