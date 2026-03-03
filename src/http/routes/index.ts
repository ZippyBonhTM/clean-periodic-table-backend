import { Router, type RequestHandler } from "express";

import type ListAllElements from "../../application/usecases/ListAllElements.js";
import type { AppEnv } from "../../config/env.js";
import { createElementsRoutes } from "./elementsRoutes.js";
import { createHealthRoutes } from "./healthRoutes.js";

type CreateApiRouterInput = {
  appEnv: AppEnv;
  listAllElements: ListAllElements;
  authMiddleware?: RequestHandler;
};

function createApiRouter({ appEnv, listAllElements, authMiddleware }: CreateApiRouterInput): Router {
  const router = Router();
  const elementsRoutesInput = {
    listAllElements,
    ...(authMiddleware !== undefined ? { authMiddleware } : {}),
  };

  router.use(createHealthRoutes(appEnv));
  router.use(createElementsRoutes(elementsRoutesInput));

  return router;
}

export { createApiRouter };
export type { CreateApiRouterInput };
