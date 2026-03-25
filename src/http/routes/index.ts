import { Router, type RequestHandler } from "express";

import type ManageEditableArticles from "../../application/usecases/ManageEditableArticles.js";
import type ManagePublicArticles from "../../application/usecases/ManagePublicArticles.js";
import type ManageSavedArticles from "../../application/usecases/ManageSavedArticles.js";
import type ManageOwnedArticles from "../../application/usecases/ManageOwnedArticles.js";
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
  manageEditableArticles?: ManageEditableArticles;
  managePublicArticles?: ManagePublicArticles;
  manageSavedArticles?: ManageSavedArticles;
  manageOwnedArticles?: ManageOwnedArticles;
  listAllElements: ListAllElements;
  manageAdminUsers?: ManageAdminUsers;
  manageUserMolecules: ManageUserMolecules;
  authMiddleware?: RequestHandler;
  syncProductUserMiddleware?: RequestHandler;
};

function createApiRouter({
  appEnv,
  manageEditableArticles,
  managePublicArticles,
  manageSavedArticles,
  manageOwnedArticles,
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
  if (
    manageEditableArticles !== undefined ||
    managePublicArticles !== undefined ||
    manageSavedArticles !== undefined ||
    manageOwnedArticles !== undefined
  ) {
    router.use(
      createArticleRoutes({
        ...(manageEditableArticles !== undefined ? { manageEditableArticles } : {}),
        ...(managePublicArticles !== undefined ? { managePublicArticles } : {}),
        ...(manageSavedArticles !== undefined ? { manageSavedArticles } : {}),
        ...(manageOwnedArticles !== undefined ? { manageOwnedArticles } : {}),
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
