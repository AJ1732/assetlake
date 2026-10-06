import type {
  AssetLakeImageResult,
  ImagePurpose,
} from "@assetlake/core/contracts";
import { useCallback, useReducer } from "react";

import { type UploadDetails, uploadImage } from "./upload-image";
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

  async function send(selection: UploadSelection, details: UploadDetails) {
    const outcome = await uploadImage({
      ...details,
      file: selection.file,
      purpose,
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

  function start(details: UploadDetails) {
    if (state.phase !== "previewing") return;
    dispatch({ type: "START" });
    void send(state, details);
  }

  function retry(details: UploadDetails) {
    if (state.phase !== "error" || !state.selection) return;
    dispatch({ type: "RETRY" });
    void send(state.selection, details);
  }

  const reset = () => dispatch({ type: "RESET" });

  return { state, selectFile, start, retry, reset };
}

/**
 * Callback ref for the preview <img>: revokes its object URL once the element is really gone or shows
 * a different URL. Memoized per URL, because a new callback identity on every render would detach
 * and revoke the URL that is still on screen.
 */
export function useRevokeObjectUrlOnDetach(objectUrl: string | null) {
  return useCallback(
    (node: Pick<HTMLImageElement, "isConnected" | "src"> | null) =>
      node && objectUrl ? revokeWhenDetached(node, objectUrl) : undefined,
    [objectUrl],
  );
}

// React 19 StrictMode detaches and re-attaches every ref once in development. Revoking synchronously
// in the cleanup broke the re-attached preview, so the check waits a tick and spares a URL still shown.
export function revokeWhenDetached(
  node: Pick<HTMLImageElement, "isConnected" | "src">,
  objectUrl: string,
): () => void {
  return () => {
    setTimeout(() => {
      if (!node.isConnected || node.src !== objectUrl)
        URL.revokeObjectURL(objectUrl);
    }, 0);
  };
}
