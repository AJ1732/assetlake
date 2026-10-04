export const MISSING = "Not set";

const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;
const BYTES_PER_UNIT = 1024;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function formatBytes(bytes: number | null | undefined): string {
  if (!isFiniteNumber(bytes) || bytes < 0) return MISSING;
  let value = bytes;
  let unitIndex = 0;
  while (value >= BYTES_PER_UNIT && unitIndex < BYTE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 ? 0 : 1;
  const rounded = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
  return `${rounded} ${BYTE_UNITS[unitIndex]}`;
}

export function formatExactBytes(bytes: number | null | undefined): string {
  if (!isFiniteNumber(bytes) || bytes < 0) return MISSING;
  return `${new Intl.NumberFormat("en-US").format(bytes)} bytes`;
}

export function formatDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
): string {
  if (!isFiniteNumber(width) || !isFiniteNumber(height)) return MISSING;
  return `${width} × ${height}`;
}

export function formatTimestamp(
  iso: string | null | undefined,
  timeZone?: string,
): string {
  if (!iso) return MISSING;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return MISSING;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export function formatLabel(value: string | null | undefined): string {
  if (!value) return MISSING;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
