import { AssetLakeError } from "../errors/asset-lake-error";

const notAllowed = () =>
  new AssetLakeError(
    "SOURCE_URL_NOT_ALLOWED",
    "The source URL is not allowed: it must be https on an allowed host.",
  );

function hostMatches(host: string, pattern: string): boolean {
  const normalized = pattern.toLowerCase();
  if (!normalized.startsWith("*.")) return host === normalized;
  // "*.example.com" covers sub.example.com but not example.com or evilexample.com.
  return host.endsWith(normalized.slice(1));
}

/**
 * Runs before Sanity is asked to fetch anything. Without it, whoever controls the URL decides what
 * lands in the dataset and on the bill. Errors never echo the URL: presigned URLs carry signatures.
 * Returns the host, the only part of the URL that is safe to log.
 */
export function checkSourceUrl(
  url: string,
  allowedHosts: readonly string[],
): string {
  if (!URL.canParse(url)) throw notAllowed();
  const parsed = new URL(url);
  const plainHttps =
    parsed.protocol === "https:" &&
    parsed.username === "" &&
    parsed.password === "" &&
    parsed.port === "";
  if (!plainHttps) throw notAllowed();
  if (!allowedHosts.some((pattern) => hostMatches(parsed.hostname, pattern)))
    throw notAllowed();
  return parsed.hostname;
}
