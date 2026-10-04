import type {
  ApiErrorCode,
  AssetLakeImageResult,
} from "@assetlake/core/contracts";

// Transport failures never reach the route handler, so they get client-side codes.
export type UploadErrorCode =
  | ApiErrorCode
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE";

export interface UploadError {
  code: UploadErrorCode;
  message: string;
}

export interface UploadSelection {
  file: File;
  previewUrl: string;
  idempotencyKey: string;
}

export type UploadState =
  | { phase: "idle" }
  | ({ phase: "previewing" } & UploadSelection)
  | ({ phase: "uploading"; percent: number } & UploadSelection)
  | ({ phase: "processing" } & UploadSelection)
  | ({ phase: "done"; result: AssetLakeImageResult } & UploadSelection)
  | { phase: "error"; error: UploadError; selection: UploadSelection | null };

export type UploadEvent =
  | { type: "SELECT"; selection: UploadSelection }
  | { type: "REJECT"; error: UploadError }
  | { type: "START" }
  | { type: "PROGRESS"; percent: number }
  | { type: "BYTES_SENT" }
  | { type: "SUCCEEDED"; result: AssetLakeImageResult }
  | { type: "FAILED"; error: UploadError }
  | { type: "RETRY" }
  | { type: "RESET" };

export const INITIAL_UPLOAD_STATE: UploadState = { phase: "idle" };

export const isUploadInFlight = (state: UploadState) =>
  state.phase === "uploading" || state.phase === "processing";

function selectionOf(state: UploadState): UploadSelection | null {
  if (state.phase === "idle") return null;
  if (state.phase === "error") return state.selection;
  const { file, previewUrl, idempotencyKey } = state;
  return { file, previewUrl, idempotencyKey };
}

/**
 * Pure transition function. Events that do not apply to the current phase return the same state
 * object, so a late XHR callback can never move the UI backwards. "processing" covers Sanity's
 * ingestion after the bytes are sent (about 4.7s measured in B02), so the bar never sits at 100%.
 */
export function uploadReducer(
  state: UploadState,
  event: UploadEvent,
): UploadState {
  if (isUploadInFlight(state)) {
    const selection = selectionOf(state)!;
    switch (event.type) {
      case "PROGRESS": {
        if (state.phase !== "uploading") return state;
        const percent = Math.min(
          100,
          Math.max(state.percent, Math.round(event.percent)),
        );
        return percent === state.percent ? state : { ...state, percent };
      }
      case "BYTES_SENT": {
        return state.phase === "uploading"
          ? { phase: "processing", ...selection }
          : state;
      }
      case "SUCCEEDED": {
        return { phase: "done", result: event.result, ...selection };
      }
      case "FAILED": {
        return { phase: "error", error: event.error, selection };
      }
      default: {
        return state;
      }
    }
  }

  switch (event.type) {
    case "SELECT": {
      return { phase: "previewing", ...event.selection };
    }
    case "REJECT": {
      return { phase: "error", error: event.error, selection: null };
    }
    case "START": {
      return state.phase === "previewing"
        ? { phase: "uploading", percent: 0, ...selectionOf(state)! }
        : state;
    }
    case "RETRY": {
      // Same idempotency key on purpose: if the first attempt reached Sanity but the response was
      // lost, the server returns the existing record instead of creating a duplicate.
      return state.phase === "error" && state.selection
        ? { phase: "uploading", percent: 0, ...state.selection }
        : state;
    }
    case "RESET": {
      return state.phase === "idle" ? state : INITIAL_UPLOAD_STATE;
    }
    default: {
      return state;
    }
  }
}
