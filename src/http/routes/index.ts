import { Router, type RequestHandler } from "express";

import type ManageSavedArticles from "../../application/usecases/ManageSavedArticles.js";
import type ListAllElements from "../../application/usecases/ListAllElements.js";
import type ManageAdminUsers from "../../application/usecases/ManageAdminUsers.js";
import type ManageUserMolecules from "../../application/usecases/ManageUserMolecules.js";
import type { AppEnv } from "../../config/env.js";
import { createAdminRoutes } from "./adminRoutes.js";
import { createArticleRoutes } from "./articleRoutes.js";
import { createElementsRoutes } from "./elementsRoutes.js";
import { createHealthRoutes } from "./healthRoutes.js";
import { createMoleculesRoutes } from "./moleculesRoutes.js";

type CreateApiRouterInput = {
  appEnv: AppEnv;
  manageSavedArticles?: ManageSavedArticles;
  listAllElements: ListAllElements;
  manageAdminUsers?: ManageAdminUsers;
  manageUserMolecules: ManageUserMolecules;
  authMiddleware?: RequestHandler;
  syncProductUserMiddleware?: RequestHandler;
};

function createApiRouter({
  appEnv,
  manageSavedArticles,
  listAllElements,
  manageAdminUsers,
  manageUserMolecules,
  authMiddleware,
  syncProductUserMiddleware,
}: CreateApiRouterInput): Router {
  const router = Router();
  const elementsRoutesInput = {
    listAllElements,
  };
  const moleculesRoutesInput = {
    manageUserMolecules,
    ...(authMiddleware !== undefined ? { authMiddleware } : {}),
    ...(syncProductUserMiddleware !== undefined ? { syncProductUserMiddleware } : {}),
  };
  router.use(createHealthRoutes(appEnv));
  router.use(createElementsRoutes(elementsRoutesInput));
  router.use(createMoleculesRoutes(moleculesRoutesInput));
  if (manageSavedArticles !== undefined) {
    router.use(
      createArticleRoutes({
        manageSavedArticles,
        ...(authMiddleware !== undefined ? { authMiddleware } : {}),
        ...(syncProductUserMiddleware !== undefined ? { syncProductUserMiddleware } : {}),
      }),
    );
  }
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
