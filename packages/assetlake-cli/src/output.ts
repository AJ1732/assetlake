export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
}

export interface CommandResult {
  exitCode: 0 | 1;
  output: unknown;
}

/** stdout carries exactly one JSON document, so `assetlake ... | jq` always works. */
export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function scrub(text: string, secrets: readonly string[]): string {
  return secrets.reduce(
    (scrubbed, secret) => scrubbed.replaceAll(secret, "[redacted]"),
    text,
  );
}
