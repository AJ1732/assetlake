import type { AssetLakeErrorCode } from "../contracts";

export class AssetLakeError extends Error {
  readonly code: AssetLakeErrorCode;

  constructor(
    code: AssetLakeErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AssetLakeError";
    this.code = code;
  }
}

export const isAssetLakeError = (error: unknown): error is AssetLakeError =>
  error instanceof AssetLakeError;

export function hasStatusCode(error: unknown, statusCode: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode: unknown }).statusCode === statusCode
  );
}
