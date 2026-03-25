import express, { type Express, type RequestHandler } from "express";

import type ManagePublicArticles from "../application/usecases/ManagePublicArticles.js";
import type ManageSavedArticles from "../application/usecases/ManageSavedArticles.js";
import type ListAllElements from "../application/usecases/ListAllElements.js";
import type ManageAdminUsers from "../application/usecases/ManageAdminUsers.js";
import type ManageUserMolecules from "../application/usecases/ManageUserMolecules.js";
import type { AppEnv } from "../config/env.js";
import { AppError } from "./errors/AppError.js";
import { createErrorHandlingMiddleware } from "./middlewares/errorHandling.js";
import { createApiRouter } from "./routes/index.js";

type CreateExpressAppInput = {
  appEnv: AppEnv;
  managePublicArticles?: ManagePublicArticles;
  manageSavedArticles?: ManageSavedArticles;
  listAllElements: ListAllElements;
  manageAdminUsers?: ManageAdminUsers;
  manageUserMolecules: ManageUserMolecules;
  authMiddleware?: RequestHandler;
  syncProductUserMiddleware?: RequestHandler;
};

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed === "*") {
    return trimmed;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function readAllowedOrigins(rawValue: string | undefined): Set<string> {
  const fallback = ["http://localhost:3000", "http://127.0.0.1:3000"];
  const source = rawValue?.trim().length ? rawValue : fallback.join(",");
  const values = source
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => value !== null)
    .filter((value) => value.length > 0);

  return new Set(values);
}

function createExpressApp({
  appEnv,
  managePublicArticles,
  manageSavedArticles,
  listAllElements,
  manageAdminUsers,
  manageUserMolecules,
  authMiddleware,
  syncProductUserMiddleware,
}: CreateExpressAppInput): Express {
  const app = express();
  const allowedOrigins = readAllowedOrigins(process.env.CORS_ORIGINS);

  app.use(express.json());
  app.use((request, response, next) => {
    const requestOrigin = request.headers.origin;
    const origin = Array.isArray(requestOrigin) ? requestOrigin[0] : requestOrigin;
    const normalizedOrigin = origin !== undefined ? normalizeOrigin(origin) : null;

    if (
      normalizedOrigin !== null &&
      (allowedOrigins.has(normalizedOrigin) || allowedOrigins.has("*"))
    ) {
      response.header("Access-Control-Allow-Origin", normalizedOrigin);
      response.header("Access-Control-Allow-Credentials", "true");
      response.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      response.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      response.header("Vary", "Origin");
    }

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  });
  app.use(
    createApiRouter({
      appEnv,
      ...(managePublicArticles !== undefined ? { managePublicArticles } : {}),
      ...(manageSavedArticles !== undefined ? { manageSavedArticles } : {}),
      listAllElements,
      ...(manageAdminUsers !== undefined ? { manageAdminUsers } : {}),
      manageUserMolecules,
      ...(authMiddleware !== undefined ? { authMiddleware } : {}),
      ...(syncProductUserMiddleware !== undefined ? { syncProductUserMiddleware } : {}),
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
