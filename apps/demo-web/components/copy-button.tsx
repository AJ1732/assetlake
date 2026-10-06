"use client";

import { cn } from "cn";
import { useState } from "react";

import { Button } from "@/components/ui/button";

const COPIED_RESET_MS = 1600;

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    setTimeout(() => setStatus("idle"), COPIED_RESET_MS);
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void copy()}
      className={cn("h-8 px-2.5 font-mono text-xs tabular-nums", className)}
    >
      <span aria-live="polite">
        {status === "copied"
          ? "Copied"
          : status === "failed"
            ? "Copy failed"
            : label}
      </span>
    </Button>
  );
}
