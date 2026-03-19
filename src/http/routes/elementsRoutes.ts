import { Router } from "express";

import type ListAllElements from "../../application/usecases/ListAllElements.js";
import { AppError } from "../errors/AppError.js";

type CreateElementsRoutesInput = {
  listAllElements: ListAllElements;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function createElementsRoutes({ listAllElements }: CreateElementsRoutesInput): Router {
  const router = Router();

  router.get("/elements", async (_request, response, next) => {
    try {
      const elements = await listAllElements.list();
      response.status(200).json(elements);
    } catch (error: unknown) {
      next(
        new AppError({
          statusCode: 500,
          code: "LIST_ELEMENTS_FAILED",
          message: toErrorMessage(error),
          publicMessage: "Internal error while listing elements.",
          layer: "application",
          cause: error,
        }),
      );
    }
  });

  return router;
}

export { createElementsRoutes };
export type { CreateElementsRoutesInput };
