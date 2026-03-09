import type { Server } from "node:http";
import { pathToFileURL } from "node:url";

import type { RequestHandler } from "express";

import ListAllElements from "./application/usecases/ListAllElements.js";
import ManageUserMolecules from "./application/usecases/ManageUserMolecules.js";
import env from "./config/env.js";
import type { AppEnv } from "./config/env.js";
import { createExpressApp } from "./http/createExpressApp.js";
import { createRequireAuthMiddleware } from "./http/middlewares/requireAuth.js";
import AuthServiceTokenValidator from "./infrastructure/auth/AuthServiceTokenValidator.js";
import { connectMongo, disconnectMongo } from "./infrastructure/mongoose/connect.js";
import MongoElementRepository from "./infrastructure/mongoose/repositories/MongoElementRepository.js";
import MongoUserMoleculeRepository from "./infrastructure/mongoose/repositories/MongoUserMoleculeRepository.js";
import InMemoryElementRepository from "./infrastructure/repositories/InMemoryElementRepository.js";
import InMemoryUserMoleculeRepository from "./infrastructure/repositories/InMemoryUserMoleculeRepository.js";

function createShutdownHandler(
  server: Server,
  isMongoSource: boolean,
  disconnect: () => Promise<void> = disconnectMongo,
): (signal: string) => Promise<void> {
  return async (signal: string): Promise<void> => {
    process.stdout.write(`Received ${signal}. Shutting down.\n`);

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error !== undefined) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    if (isMongoSource) {
      await disconnect();
    }
  };
}

function buildAuthMiddleware(appEnv: AppEnv): RequestHandler | undefined {
  if (!appEnv.authRequired) {
    return undefined;
  }

  if (appEnv.authServiceUrl === null) {
    throw new Error("AUTH_SERVICE_URL is required when AUTH_REQUIRED=true.");
  }

  const validator = new AuthServiceTokenValidator(appEnv.authServiceUrl, appEnv.authValidatePath);

  return createRequireAuthMiddleware(validator);
}

function isExecutedDirectly(importMetaUrl: string): boolean {
  const entrypointPath = process.argv[1];

  if (entrypointPath === undefined) {
    return false;
  }

  return pathToFileURL(entrypointPath).href === importMetaUrl;
}

async function bootstrap(appEnv: AppEnv = env): Promise<void> {
  const isMongoSource = appEnv.dataSource === "mongo";

  if (isMongoSource && appEnv.mongoUri !== null) {
    await connectMongo(appEnv.mongoUri);
  }

  const elementRepository = isMongoSource
    ? new MongoElementRepository()
    : new InMemoryElementRepository();
  const userMoleculeRepository = isMongoSource
    ? new MongoUserMoleculeRepository()
    : new InMemoryUserMoleculeRepository();
  const listAllElements = new ListAllElements(elementRepository);
  const manageUserMolecules = new ManageUserMolecules(userMoleculeRepository);
  const authMiddleware = buildAuthMiddleware(appEnv);
  const appInput = {
    appEnv,
    listAllElements,
    manageUserMolecules,
    ...(authMiddleware !== undefined ? { authMiddleware } : {}),
  };
  const app = createExpressApp(appInput);

  const server = await new Promise<Server>((resolve) => {
    const startedServer = app.listen(appEnv.port, appEnv.host, () => {
      process.stdout.write(
        `Backend listening on http://${appEnv.host}:${String(appEnv.port)} (env=${appEnv.nodeEnv}, source=${appEnv.dataSource})\n`,
      );
      resolve(startedServer);
    });
  });

  const shutdown = createShutdownHandler(server, isMongoSource);

  process.on("SIGINT", () => {
    shutdown("SIGINT")
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        process.stderr.write(`Shutdown error: ${String(error)}\n`);
        process.exit(1);
      });
  });

  process.on("SIGTERM", () => {
    shutdown("SIGTERM")
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        process.stderr.write(`Shutdown error: ${String(error)}\n`);
        process.exit(1);
      });
  });
}

async function runMain(): Promise<void> {
  try {
    await bootstrap();
  } catch (error: unknown) {
    process.stderr.write(`Startup error: ${String(error)}\n`);

    try {
      await disconnectMongo();
    } catch {
      // ignore cleanup error
    }

    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test" && isExecutedDirectly(import.meta.url)) {
  runMain();
}

export { bootstrap, buildAuthMiddleware, createShutdownHandler, isExecutedDirectly, runMain };
