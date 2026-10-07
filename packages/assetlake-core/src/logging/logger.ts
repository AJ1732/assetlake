export type LogEvent =
  | "ASSET_UPLOAD_STARTED"
  | "ASSET_UPLOAD_COMPLETED"
  | "ASSET_UPLOAD_REPLAYED"
  | "ASSET_UPLOAD_REJECTED"
  | "ASSET_UPLOAD_FAILED"
  | "ASSET_COMPENSATION_DELETED"
  | "ASSET_COMPENSATION_SKIPPED_REFERENCED"
  | "ASSET_COMPENSATION_DELETE_FAILED"
  | "ASSET_DELETE_COMPLETED"
  | "IMAGE_STATUS_TRANSITIONED"
  | "IMAGE_STATUS_TRANSITION_REFUSED"
  | "PRESET_NOT_FOUND"
  | "PRESET_INVALID";

export type LogLevel = "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

export interface Logger {
  log(level: LogLevel, event: LogEvent, fields?: LogFields): void;
}

const SENSITIVE_KEY = /token|authorization|secret|password|cookie/i;
const REDACTED = "[redacted]";

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value instanceof Uint8Array) return `[${value.byteLength} bytes]`;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : redact(nested),
      ]),
    );
  }
  return value;
}

export function createJsonLogger(
  write: (line: string) => void = console.log,
): Logger {
  return {
    log(level, event, fields = {}) {
      write(
        JSON.stringify({
          level,
          event,
          at: new Date().toISOString(),
          ...(redact(fields) as LogFields),
        }),
      );
    },
  };
}

export const silentLogger: Logger = { log: () => {} };
