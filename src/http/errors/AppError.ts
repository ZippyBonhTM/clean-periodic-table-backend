type ErrorLayer = "domain" | "application" | "infrastructure" | "http" | "unknown";

type AppErrorInput = {
  statusCode: number;
  code: string;
  message: string;
  publicMessage?: string;
  layer: ErrorLayer;
  details?: unknown;
  cause?: unknown;
};

class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly publicMessage: string;
  readonly layer: ErrorLayer;
  readonly details: unknown;

  constructor({ statusCode, code, message, publicMessage, layer, details, cause }: AppErrorInput) {
    super(message, cause === undefined ? undefined : { cause });

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.publicMessage = publicMessage ?? message;
    this.layer = layer;
    this.details = details;
  }
}

function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export { AppError, isAppError };
export type { AppErrorInput, ErrorLayer };
