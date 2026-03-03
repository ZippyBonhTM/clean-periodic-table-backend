import express, { type Express, type RequestHandler } from "express";

import type ListAllElements from "../application/usecases/ListAllElements.js";
import type { AppEnv } from "../config/env.js";

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

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      env: appEnv.nodeEnv,
      dataSource: appEnv.dataSource,
    });
  });

  const elementsHandlers: RequestHandler[] = [];

  if (authMiddleware !== undefined) {
    elementsHandlers.push(authMiddleware);
  }

  elementsHandlers.push(async (_request, response) => {
    try {
      const elements = await listAllElements.list();
      response.status(200).json(elements);
    } catch (error: unknown) {
      response.status(500).json({
        message: "Internal error while listing elements.",
        error: String(error),
      });
    }
  });

  app.get("/elements", ...elementsHandlers);

  app.use((_request, response) => {
    response.status(404).json({ message: "Not found" });
  });

  return app;
}

export { createExpressApp };
export type { CreateExpressAppInput };
