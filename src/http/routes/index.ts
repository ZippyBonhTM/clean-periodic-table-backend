import { Router, type RequestHandler } from "express";

import type ListAllElements from "../../application/usecases/ListAllElements.js";
import type ManageAdminUsers from "../../application/usecases/ManageAdminUsers.js";
import type ManageUserMolecules from "../../application/usecases/ManageUserMolecules.js";
import type { AppEnv } from "../../config/env.js";
import { createAdminRoutes } from "./adminRoutes.js";
import { createElementsRoutes } from "./elementsRoutes.js";
import { createHealthRoutes } from "./healthRoutes.js";
import { createMoleculesRoutes } from "./moleculesRoutes.js";

type CreateApiRouterInput = {
  appEnv: AppEnv;
  listAllElements: ListAllElements;
  manageAdminUsers?: ManageAdminUsers;
  manageUserMolecules: ManageUserMolecules;
  authMiddleware?: RequestHandler;
};

function createApiRouter({
  appEnv,
  listAllElements,
  manageAdminUsers,
  manageUserMolecules,
  authMiddleware,
}: CreateApiRouterInput): Router {
  const router = Router();
  const elementsRoutesInput = {
    listAllElements,
  };
  const moleculesRoutesInput = {
    manageUserMolecules,
    ...(authMiddleware !== undefined ? { authMiddleware } : {}),
  };
  router.use(createHealthRoutes(appEnv));
  router.use(createElementsRoutes(elementsRoutesInput));
  router.use(createMoleculesRoutes(moleculesRoutesInput));
  if (manageAdminUsers !== undefined) {
    router.use(
      createAdminRoutes({
        manageAdminUsers,
        ...(authMiddleware !== undefined ? { authMiddleware } : {}),
      }),
    );
  }

  return router;
}

export { createApiRouter };
export type { CreateApiRouterInput };
