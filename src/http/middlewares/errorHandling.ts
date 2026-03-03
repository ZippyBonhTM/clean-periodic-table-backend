import type { ErrorRequestHandler } from "express";

import type { NodeEnv } from "../../config/env.js";
import { AppError, isAppError } from "../errors/AppError.js";

type ErrorHandlingEnv = {
  nodeEnv: NodeEnv;
};

type SafeErrorResponse = {
  statusCode: number;
  code: string;
  message: string;
};

function toSafeErrorResponse(error: AppError): SafeErrorResponse {
  return {
    statusCode: error.statusCode,
    code: error.code,
    message: error.publicMessage,
  };
}

function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  return new AppError({
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    message,
    publicMessage: "Internal server error.",
    layer: "unknown",
    cause: error,
  });
}

function createErrorHandlingMiddleware({ nodeEnv }: ErrorHandlingEnv): ErrorRequestHandler {
  return (error, _request, response, _next) => {
    const appError = toAppError(error);
    const safeError = toSafeErrorResponse(appError);

    if (nodeEnv === "development") {
      const sourceError = appError.cause instanceof Error ? appError.cause : appError;

      response.status(appError.statusCode).json({
        error: safeError,
        development: {
          statusCode: appError.statusCode,
          code: appError.code,
          layer: appError.layer,
          name: sourceError.name,
          message: sourceError.message,
          details: appError.details,
          stack: sourceError.stack,
        },
      });
      return;
    }

    response.status(appError.statusCode).json({
      error: safeError,
    });
  };
}

export { createErrorHandlingMiddleware, toAppError, toSafeErrorResponse };
export type { ErrorHandlingEnv, SafeErrorResponse };
