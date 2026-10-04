import type { AssetLakeImageResult } from "@assetlake/core/contracts";
import { describe, expect, it } from "vitest";

import {
  INITIAL_UPLOAD_STATE,
  isUploadInFlight,
  type UploadEvent,
  uploadReducer,
  type UploadSelection,
  type UploadState,
} from "./upload-machine";

const selection = (key = "key-1"): UploadSelection => ({
  file: new File([new Uint8Array([1, 2, 3])], "avatar.png", {
    type: "image/png",
  }),
  previewUrl: `blob:preview-${key}`,
  idempotencyKey: key,
});

const result: AssetLakeImageResult = {
  id: "assetlake-image-1",
  assetId: "image-abc-256x256-png",
  url: "https://cdn.sanity.io/images/oshzwvjy/production/abc-256x256.png",
  mimeType: "image/png",
  size: 3,
  width: 256,
  height: 256,
  aspectRatio: 1,
  lqip: null,
  blurHash: null,
  status: "ready",
};

const run = (events: UploadEvent[], from: UploadState = INITIAL_UPLOAD_STATE) =>
  events.reduce(uploadReducer, from);

const failure = { code: "UPLOAD_FAILED", message: "Sanity said no." } as const;

describe("uploadReducer", () => {
  it("walks the happy path idle -> previewing -> uploading -> processing -> done", () => {
    const chosen = selection();
    const previewing = run([{ type: "SELECT", selection: chosen }]);
    expect(previewing).toEqual({ phase: "previewing", ...chosen });

    const uploading = uploadReducer(previewing, { type: "START" });
    expect(uploading).toEqual({ phase: "uploading", percent: 0, ...chosen });

    const halfway = uploadReducer(uploading, {
      type: "PROGRESS",
      percent: 49.6,
    });
    expect(halfway).toMatchObject({ phase: "uploading", percent: 50 });

    const processing = uploadReducer(halfway, { type: "BYTES_SENT" });
    expect(processing).toEqual({ phase: "processing", ...chosen });

    expect(uploadReducer(processing, { type: "SUCCEEDED", result })).toEqual({
      phase: "done",
      result,
      ...chosen,
    });
  });

  it("goes straight from uploading to done when the bytes-sent event never fires", () => {
    const state = run([
      { type: "SELECT", selection: selection() },
      { type: "START" },
    ]);
    expect(uploadReducer(state, { type: "SUCCEEDED", result }).phase).toBe(
      "done",
    );
  });

  it("clamps progress to 0..100 and never moves it backwards", () => {
    const uploading = run([
      { type: "SELECT", selection: selection() },
      { type: "START" },
    ]);
    const sixty = uploadReducer(uploading, { type: "PROGRESS", percent: 60 });
    expect(uploadReducer(sixty, { type: "PROGRESS", percent: 30 })).toBe(sixty);
    expect(
      uploadReducer(sixty, { type: "PROGRESS", percent: 140 }),
    ).toMatchObject({ percent: 100 });
  });

  it("moves to error with the selection kept when the upload fails", () => {
    const chosen = selection();
    const state = run([
      { type: "SELECT", selection: chosen },
      { type: "START" },
      { type: "BYTES_SENT" },
      { type: "FAILED", error: failure },
    ]);
    expect(state).toEqual({
      phase: "error",
      error: failure,
      selection: chosen,
    });
  });

  it("retries with the same idempotency key", () => {
    const failed = run([
      { type: "SELECT", selection: selection("key-original") },
      { type: "START" },
      { type: "FAILED", error: failure },
    ]);
    const retrying = uploadReducer(failed, { type: "RETRY" });
    expect(retrying).toMatchObject({
      phase: "uploading",
      percent: 0,
      idempotencyKey: "key-original",
    });
  });

  it("uses the new key when a different file is selected", () => {
    const state = run([
      { type: "SELECT", selection: selection("key-1") },
      { type: "SELECT", selection: selection("key-2") },
    ]);
    expect(state).toMatchObject({
      phase: "previewing",
      idempotencyKey: "key-2",
    });
  });

  it("rejects a file client-side with nothing to retry", () => {
    const rejected = run([
      {
        type: "REJECT",
        error: { code: "FILE_TOO_LARGE", message: "Too big." },
      },
    ]);
    expect(rejected).toEqual({
      phase: "error",
      error: { code: "FILE_TOO_LARGE", message: "Too big." },
      selection: null,
    });
    expect(uploadReducer(rejected, { type: "RETRY" })).toBe(rejected);
  });

  it("ignores selection, reset, and start while a request is in flight", () => {
    const uploading = run([
      { type: "SELECT", selection: selection() },
      { type: "START" },
    ]);
    for (const event of [
      { type: "SELECT", selection: selection("key-9") },
      { type: "RESET" },
      { type: "START" },
      { type: "RETRY" },
      { type: "REJECT", error: failure },
    ] as UploadEvent[]) {
      expect(uploadReducer(uploading, event)).toBe(uploading);
    }
    expect(isUploadInFlight(uploading)).toBe(true);
  });

  it("ignores late transport events once settled", () => {
    const done = run([
      { type: "SELECT", selection: selection() },
      { type: "START" },
      { type: "SUCCEEDED", result },
    ]);
    for (const event of [
      { type: "PROGRESS", percent: 10 },
      { type: "BYTES_SENT" },
      { type: "FAILED", error: failure },
      { type: "SUCCEEDED", result },
    ] as UploadEvent[]) {
      expect(uploadReducer(done, event)).toBe(done);
    }
  });

  it("ignores start without a selection and resets from any settled phase", () => {
    expect(uploadReducer(INITIAL_UPLOAD_STATE, { type: "START" })).toBe(
      INITIAL_UPLOAD_STATE,
    );
    expect(uploadReducer(INITIAL_UPLOAD_STATE, { type: "RESET" })).toBe(
      INITIAL_UPLOAD_STATE,
    );
    const previewing = run([{ type: "SELECT", selection: selection() }]);
    expect(uploadReducer(previewing, { type: "RESET" })).toEqual(
      INITIAL_UPLOAD_STATE,
    );
  });

  it("only treats uploading and processing as in flight", () => {
    expect(isUploadInFlight(INITIAL_UPLOAD_STATE)).toBe(false);
    expect(
      isUploadInFlight(run([{ type: "SELECT", selection: selection() }])),
    ).toBe(false);
  });
});
