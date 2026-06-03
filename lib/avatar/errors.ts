export type AvatarErrorCode =
  | "MISSING_CREDENTIALS"
  | "INVALID_CONFIG"
  | "PROVIDER_API_ERROR"
  | "SESSION_NOT_FOUND"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "WEBHOOK_INVALID"
  | "NOT_CONFIGURED"
  | "PAUSED"
  | "UNSUPPORTED";

export class AvatarProviderError extends Error {
  code: AvatarErrorCode;
  provider?: string;
  statusCode?: number;

  constructor(
    code: AvatarErrorCode,
    message: string,
    opts?: { provider?: string; statusCode?: number; raw?: unknown }
  ) {
    super(message);
    this.name = "AvatarProviderError";
    this.code = code;
    this.provider = opts?.provider;
    this.statusCode = opts?.statusCode;
  }
}

export function isAvatarProviderError(err: unknown): err is AvatarProviderError {
  return err instanceof AvatarProviderError;
}
