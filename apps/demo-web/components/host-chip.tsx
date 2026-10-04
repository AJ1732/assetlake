import { cn } from "cn";

/** Shows which host actually served an image, read from the URL rather than asserted in copy. */
export function HostChip({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const host = new URL(url).host;
  return (
    <span
      className={cn("host-chip", className)}
      data-host={host}
      translate="no"
    >
      <span aria-hidden="true" className="host-chip-dot" />
      {host}
    </span>
  );
}
