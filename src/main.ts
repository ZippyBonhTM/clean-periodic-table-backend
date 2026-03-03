import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Server } from "node:http";
import { pathToFileURL } from "node:url";

import ListAllElements from "./application/usecases/ListAllElements.js";
import env from "./config/env.js";
import type { AppEnv } from "./config/env.js";
import { connectMongo, disconnectMongo } from "./infrastructure/mongoose/connect.js";
import MongoElementRepository from "./infrastructure/mongoose/repositories/MongoElementRepository.js";
import InMemoryElementRepository from "./infrastructure/repositories/InMemoryElementRepository.js";

type RequestHandler = (
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
) => Promise<void>;

function writeJson(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
  payload: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function createRequestHandler(listAllElements: ListAllElements, appEnv: AppEnv): RequestHandler {
  return async (request, response) => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, {
        status: "ok",
        env: appEnv.nodeEnv,
        dataSource: appEnv.dataSource,
      });
      return;
    }

    if (method === "GET" && url.pathname === "/elements") {
      try {
        const elements = await listAllElements.list();
        writeJson(response, 200, elements);
      } catch (error: unknown) {
        writeJson(response, 500, {
          message: "Internal error while listing elements.",
          error: String(error),
        });
      }
      return;
    }

    writeJson(response, 404, { message: "Not found" });
  };
}

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

  const repository = isMongoSource
    ? new MongoElementRepository()
    : new InMemoryElementRepository();

  const listAllElements = new ListAllElements(repository);
  const requestHandler = createRequestHandler(listAllElements, appEnv);
  const server = createServer((request, response) => {
    requestHandler(request, response).catch((error: unknown) => {
      writeJson(response, 500, {
        message: "Unexpected request failure.",
        error: String(error),
      });
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

  await new Promise<void>((resolve) => {
    server.listen(appEnv.port, appEnv.host, () => {
      process.stdout.write(
        `Backend listening on http://${appEnv.host}:${String(appEnv.port)} (env=${appEnv.nodeEnv}, source=${appEnv.dataSource})\n`,
      );
      resolve();
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

export { bootstrap, createRequestHandler, createShutdownHandler, isExecutedDirectly, runMain };
