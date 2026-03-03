import express, { type Express, type RequestHandler } from "express";

import type ListAllElements from "../application/usecases/ListAllElements.js";
import type { AppEnv } from "../config/env.js";
import { AppError } from "./errors/AppError.js";
import { createErrorHandlingMiddleware } from "./middlewares/errorHandling.js";
import { createApiRouter } from "./routes/index.js";

type CreateExpressAppInput = {
  appEnv: AppEnv;
  listAllElements: ListAllElements;
  authMiddleware?: RequestHandler;
};

function createExpressApp({
  appEnv,
  listAllElements,
  authMiddleware,
}: CreateExpressAppInput): Express {
  const app = express();

  app.use(express.json());
  app.use(
    createApiRouter({
      appEnv,
      listAllElements,
      ...(authMiddleware !== undefined ? { authMiddleware } : {}),
    }),
  );

  app.use((_request, _response, next) => {
    next(
      new AppError({
        statusCode: 404,
        code: "ROUTE_NOT_FOUND",
        message: "Route not found.",
        publicMessage: "Not found",
        layer: "http",
      }),
    );
  });
  app.use(createErrorHandlingMiddleware({ nodeEnv: appEnv.nodeEnv }));

  return app;
}

export { createExpressApp };
export type { CreateExpressAppInput };
