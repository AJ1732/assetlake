import type {
  AssetLakeImageResult,
  ImagePurpose,
} from "@assetlake/core/contracts";
import { useCallback, useReducer } from "react";

import { uploadImage } from "./upload-image";
import { checkUploadLimits } from "./upload-limits";
import {
  INITIAL_UPLOAD_STATE,
  isUploadInFlight,
  uploadReducer,
  type UploadSelection,
} from "./upload-machine";

export function useImageUpload({
  purpose,
  onUploaded,
}: {
  purpose: ImagePurpose;
  onUploaded: (result: AssetLakeImageResult) => void;
}) {
  const [state, dispatch] = useReducer(uploadReducer, INITIAL_UPLOAD_STATE);

  async function send(selection: UploadSelection, alt: string) {
    const outcome = await uploadImage({
      file: selection.file,
      purpose,
      alt,
      idempotencyKey: selection.idempotencyKey,
      onProgress: (percent) => dispatch({ type: "PROGRESS", percent }),
      onBytesSent: () => dispatch({ type: "BYTES_SENT" }),
    });
    if (outcome.success) {
      dispatch({ type: "SUCCEEDED", result: outcome.data });
      onUploaded(outcome.data);
    } else {
      dispatch({ type: "FAILED", error: outcome.error });
    }
  }

  function selectFile(file: File | undefined) {
    if (!file || isUploadInFlight(state)) return;
    const rejection = checkUploadLimits(file);
    if (rejection) {
      dispatch({ type: "REJECT", error: rejection });
      return;
    }
    dispatch({
      type: "SELECT",
      selection: {
        file,
        previewUrl: URL.createObjectURL(file),
        idempotencyKey: crypto.randomUUID(),
      },
    });
  }

  function start(alt: string) {
    if (state.phase !== "previewing") return;
    dispatch({ type: "START" });
    void send(state, alt);
  }

  function retry(alt: string) {
    if (state.phase !== "error" || !state.selection) return;
    dispatch({ type: "RETRY" });
    void send(state.selection, alt);
  }

  const reset = () => dispatch({ type: "RESET" });

  return { state, selectFile, start, retry, reset };
}

/**
 * Callback ref for the preview <img>: revokes its object URL when the element detaches or the URL
 * changes (React 19 ref cleanup). Memoized per URL, because a new callback identity on every render
 * would revoke the URL that is still on screen.
 */
export function useRevokeObjectUrlOnDetach(objectUrl: string | null) {
  return useCallback(
    (node: HTMLImageElement | null) => {
      if (!node || !objectUrl) return;
      return () => URL.revokeObjectURL(objectUrl);
    },
    [objectUrl],
  );
}
