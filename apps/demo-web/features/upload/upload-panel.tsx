"use client";

import type { AssetLakeImageResult } from "@assetlake/core/contracts";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ACCEPT_ATTRIBUTE } from "./upload-limits";
import type { UploadState } from "./upload-machine";
import { useImageUpload, useRevokeObjectUrlOnDetach } from "./use-image-upload";

const previewUrlOf = (state: UploadState) => {
  if (state.phase === "idle") return null;
  if (state.phase === "error") return state.selection?.previewUrl ?? null;
  return state.previewUrl;
};

export function UploadPanel({ hasAvatar }: { hasAvatar: boolean }) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [alt, setAlt] = useState("");
  const [holdForReview, setHoldForReview] = useState(false);
  const { state, selectFile, start, retry, reset } = useImageUpload({
    purpose: "avatar",
    onUploaded: () => startRefresh(() => router.refresh()),
  });
  const previewUrl = previewUrlOf(state);
  const revokeOnDetach = useRevokeObjectUrlOnDetach(previewUrl);
  const isBusy = state.phase === "uploading" || state.phase === "processing";

  return (
    <section
      className="panel upload"
      aria-labelledby="upload-title"
      data-testid="upload-panel"
    >
      <div className="upload-head">
        <h2 id="upload-title" className="section-title">
          {hasAvatar ? "Change image" : "Add an avatar"}
        </h2>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, or WebP up to 5&nbsp;MB. 5 uploads per session. Public
          images only.
        </p>
      </div>

      <div className="upload-picker">
        <input
          id="upload-file"
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="peer sr-only"
          disabled={isBusy}
          onChange={(event) => {
            selectFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <label
          htmlFor="upload-file"
          className="file-trigger"
          aria-disabled={isBusy || undefined}
        >
          {previewUrl ? "Choose a different image" : "Choose an image"}
        </label>
      </div>

      {previewUrl ? (
        <div className="upload-preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview of a file that has not been uploaded yet; no server or CDN involved. */}
          <img
            ref={revokeOnDetach}
            src={previewUrl}
            alt="Preview of the selected image"
            className="upload-preview-image"
          />
          <span className="upload-preview-tag font-mono">
            local preview, blob:
          </span>
        </div>
      ) : null}

      {state.phase === "previewing" || state.phase === "error" ? (
        <div className="field">
          <label htmlFor="upload-alt" className="field-label">
            Alt text
          </label>
          <Input
            id="upload-alt"
            name="alt"
            autoComplete="off"
            value={alt}
            onChange={(event) => setAlt(event.currentTarget.value)}
            placeholder="e.g. Me at the lake…"
            maxLength={200}
          />
        </div>
      ) : null}

      {state.phase === "previewing" || state.phase === "error" ? (
        <label className="field-check">
          <input
            type="checkbox"
            name="review"
            checked={holdForReview}
            onChange={(event) => setHoldForReview(event.currentTarget.checked)}
          />
          <span>Hold for review</span>
          <span className="field-check-hint">
            A reviewer approves it in the AssetLake console before it shows
            here. It is still public at its URL while it waits.
          </span>
        </label>
      ) : null}

      <UploadStatus
        state={state}
        isRefreshing={isRefreshing}
        onStart={() => start({ alt, holdForReview })}
        onRetry={() => retry({ alt, holdForReview })}
        onReset={reset}
      />
    </section>
  );
}

function UploadStatus({
  state,
  isRefreshing,
  onStart,
  onRetry,
  onReset,
}: {
  state: UploadState;
  isRefreshing: boolean;
  onStart: () => void;
  onRetry: () => void;
  onReset: () => void;
}) {
  switch (state.phase) {
    case "idle": {
      return (
        <p className="text-sm text-muted-foreground">
          Pick a file to preview it locally before anything leaves your browser.
        </p>
      );
    }
    case "previewing": {
      return (
        <Button type="button" onClick={onStart} className="h-10 px-4 text-sm">
          Upload
        </Button>
      );
    }
    case "uploading":
    case "processing": {
      return <UploadProgress state={state} />;
    }
    case "done": {
      return (
        <UploadResult
          result={state.result}
          isRefreshing={isRefreshing}
          onReset={onReset}
        />
      );
    }
    case "error": {
      return (
        <div role="alert" className="upload-error">
          <p>
            <span className="font-mono text-xs">{state.error.code}</span>{" "}
            {state.error.message}
          </p>
          {state.selection ? (
            <Button
              type="button"
              onClick={onRetry}
              className="h-10 px-4 text-sm"
            >
              Retry upload
            </Button>
          ) : null}
        </div>
      );
    }
  }
}

function UploadProgress({
  state,
}: {
  state: Extract<UploadState, { phase: "uploading" | "processing" }>;
}) {
  const isProcessing = state.phase === "processing";
  const percent = isProcessing ? 100 : state.percent;
  return (
    <div className="upload-progress">
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={
          isProcessing ? "Bytes sent, Sanity is processing" : `${percent}% sent`
        }
        className="progress-track"
        data-processing={isProcessing || undefined}
      >
        <div
          className="progress-fill"
          style={{ transform: `scaleX(${percent / 100})` }}
        />
      </div>
      <p className="font-mono text-xs tabular-nums" aria-live="polite">
        {isProcessing
          ? "Bytes sent. Sanity is storing the asset and reading its metadata (a few seconds)."
          : `Sending bytes to the app backend: ${percent}%`}
      </p>
    </div>
  );
}

function resultMessage(result: AssetLakeImageResult, isRefreshing: boolean) {
  if (result.status === "review")
    return "Held for review. It appears here once a reviewer approves it; until then your current avatar stays.";
  return isRefreshing
    ? "Uploaded. Re-rendering your avatar from cdn.sanity.io…"
    : "Uploaded. Your avatar and every preset below now come from cdn.sanity.io.";
}

function UploadResult({
  result,
  isRefreshing,
  onReset,
}: {
  result: AssetLakeImageResult;
  isRefreshing: boolean;
  onReset: () => void;
}) {
  const json = JSON.stringify({ success: true, data: result }, null, 2);
  return (
    <div className="upload-result">
      <p className="text-sm" aria-live="polite">
        {resultMessage(result, isRefreshing)}
      </p>
      <details open className="result-json">
        <summary className="font-mono text-xs">
          201 POST /api/assets/images
        </summary>
        <pre tabIndex={0} translate="no">
          <code>{json}</code>
        </pre>
      </details>
      <div className="flex flex-wrap gap-2">
        <CopyButton value={result.url} label="Copy original URL" />
        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
          className="h-8 px-3"
        >
          Upload another
        </Button>
      </div>
    </div>
  );
}
