import type { IncomingMessage, ServerResponse } from "node:http";

import { describe, expect, it, vi } from "vitest";

import ListAllElements from "@/application/usecases/ListAllElements.js";
import type { AppEnv } from "@/config/env.js";
import Element from "@/domain/Element.js";
import { createRequestHandler, createShutdownHandler } from "@/main.js";

type ResponseDouble = {
  response: ServerResponse<IncomingMessage>;
  getBody: () => string;
  getHeader: (name: string) => string | undefined;
};

function createResponseDouble(): ResponseDouble {
  const headers = new Map<string, string>();
  let body = "";

  const response = {
    statusCode: 0,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    end(chunk?: string) {
      body = chunk ?? "";
      return this;
    },
  } as unknown as ServerResponse<IncomingMessage>;

  return {
    response,
    getBody: () => body,
    getHeader: (name: string) => headers.get(name.toLowerCase()),
  };
}

function createRequest(method: string, url: string): IncomingMessage {
  return {
    method,
    url,
    headers: { host: "localhost" },
  } as unknown as IncomingMessage;
}

const runtimeEnv: AppEnv = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3333,
  mongoUri: null,
  dataSource: "memory",
};

describe("createRequestHandler", () => {
  it("returns health payload on GET /health", async () => {
    const listAllElements = new ListAllElements({
      getAllElements: vi.fn().mockResolvedValue([]),
    });
    const handler = createRequestHandler(listAllElements, runtimeEnv);
    const { response, getBody, getHeader } = createResponseDouble();

    await handler(createRequest("GET", "/health"), response);

    expect(response.statusCode).toBe(200);
    expect(getHeader("content-type")).toBe("application/json; charset=utf-8");
    expect(JSON.parse(getBody())).toEqual({
      status: "ok",
      env: "test",
      dataSource: "memory",
    });
  });

  it("returns elements on GET /elements", async () => {
    const listAllElements = new ListAllElements({
      getAllElements: vi.fn().mockResolvedValue([new Element("H"), new Element("He")]),
    });
    const handler = createRequestHandler(listAllElements, runtimeEnv);
    const { response, getBody } = createResponseDouble();

    await handler(createRequest("GET", "/elements"), response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(getBody())).toEqual([{ symbol: "H" }, { symbol: "He" }]);
  });

  it("returns internal error payload when list fails", async () => {
    const listAllElements = new ListAllElements({
      getAllElements: vi.fn().mockRejectedValue(new Error("repository failed")),
    });
    const handler = createRequestHandler(listAllElements, runtimeEnv);
    const { response, getBody } = createResponseDouble();

    await handler(createRequest("GET", "/elements"), response);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(getBody())).toEqual({
      message: "Internal error while listing elements.",
      error: "Error: repository failed",
    });
  });

  it("returns not found for unknown routes", async () => {
    const listAllElements = new ListAllElements({
      getAllElements: vi.fn().mockResolvedValue([]),
    });
    const handler = createRequestHandler(listAllElements, runtimeEnv);
    const { response, getBody } = createResponseDouble();

    await handler(createRequest("GET", "/unknown"), response);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(getBody())).toEqual({ message: "Not found" });
  });
});

describe("createShutdownHandler", () => {
  it("closes server and disconnects mongo when source is mongo", async () => {
    const close = vi.fn((callback: (error?: Error) => void) => callback());
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const server = { close } as unknown as Parameters<typeof createShutdownHandler>[0];
    const shutdown = createShutdownHandler(server, true, disconnect);

    await shutdown("SIGTERM");

    expect(close).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("propagates close errors", async () => {
    const closeError = new Error("close failed");
    const close = vi.fn((callback: (error?: Error) => void) => callback(closeError));
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const server = { close } as unknown as Parameters<typeof createShutdownHandler>[0];
    const shutdown = createShutdownHandler(server, true, disconnect);

    await expect(shutdown("SIGINT")).rejects.toBe(closeError);
    expect(disconnect).not.toHaveBeenCalled();
  });
});
