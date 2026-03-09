import { Router, type RequestHandler } from "express";

import type ListAllElements from "../../application/usecases/ListAllElements.js";
import type ManageUserMolecules from "../../application/usecases/ManageUserMolecules.js";
import type { AppEnv } from "../../config/env.js";
import { createElementsRoutes } from "./elementsRoutes.js";
import { createHealthRoutes } from "./healthRoutes.js";
import { createMoleculesRoutes } from "./moleculesRoutes.js";

type CreateApiRouterInput = {
  appEnv: AppEnv;
  listAllElements: ListAllElements;
  manageUserMolecules: ManageUserMolecules;
  authMiddleware?: RequestHandler;
};

function createApiRouter({
  appEnv,
  listAllElements,
  manageUserMolecules,
  authMiddleware,
}: CreateApiRouterInput): Router {
  const router = Router();
  const elementsRoutesInput = {
    listAllElements,
    ...(authMiddleware !== undefined ? { authMiddleware } : {}),
  };
  const moleculesRoutesInput = {
    manageUserMolecules,
    ...(authMiddleware !== undefined ? { authMiddleware } : {}),
  };

  router.use(createHealthRoutes(appEnv));
  router.use(createElementsRoutes(elementsRoutesInput));
  router.use(createMoleculesRoutes(moleculesRoutesInput));

  return router;
}

export { createApiRouter };
export type { CreateApiRouterInput };
