import { Router } from "express";

import type { AppEnv } from "../../config/env.js";

function createHealthRoutes(appEnv: Pick<AppEnv, "nodeEnv" | "dataSource">): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      env: appEnv.nodeEnv,
      dataSource: appEnv.dataSource,
    });
  });

  return router;
}

export { createHealthRoutes };
