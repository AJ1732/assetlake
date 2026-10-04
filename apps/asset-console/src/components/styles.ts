import type { CSSProperties } from "react";

/** Live counts and sizes change in place; tabular figures stop them from shifting the layout. */
export const numeric: CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** Subtle outline gives images on any background a consistent edge. */
export const imageFrame: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  height: "auto",
  borderRadius: 6,
  outline: "1px solid rgb(0 0 0 / 0.08)",
  outlineOffset: -1,
};

export const breakAll: CSSProperties = { wordBreak: "break-all" };
