const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["day", 86_400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

export function formatRelativeTime(isoTime: string, now: number): string {
  const seconds = Math.round((new Date(isoTime).getTime() - now) / 1000);
  if (Number.isNaN(seconds)) return "unknown time";
  if (Math.abs(seconds) < 5) return "just now";
  const [unit, size] =
    UNITS.find(([, unitSeconds]) => Math.abs(seconds) >= unitSeconds) ??
    UNITS[3];
  return relative.format(Math.round(seconds / size), unit);
}
