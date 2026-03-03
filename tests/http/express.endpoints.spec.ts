import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import ListAllElements from "@/application/usecases/ListAllElements.js";
import type AuthTokenValidator from "@/application/protocols/AuthTokenValidator.js";
import type ElementRepository from "@/application/protocols/ElementRepository.js";
import type { AppEnv } from "@/config/env.js";
import { createExpressApp } from "@/http/createExpressApp.js";
import { createRequireAuthMiddleware } from "@/http/middlewares/requireAuth.js";
import { makeElement } from "../support/elementFixture.js";

const appEnv: AppEnv = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3333,
  mongoUri: null,
  dataSource: "memory",
  authRequired: false,
  authServiceUrl: null,
  authValidatePath: "/validate-token",
};

function makeListAllElements(repository: ElementRepository): ListAllElements {
  return new ListAllElements(repository);
}

describe("Express endpoints", () => {
  it("GET /health returns runtime status", async () => {
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([]),
      }),
    });

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      env: "test",
      dataSource: "memory",
    });
  });

  it("GET /elements returns all mapped element fields", async () => {
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi
          .fn()
          .mockResolvedValue([
            makeElement({ symbol: "H", name: "Hydrogen" }),
            makeElement({ symbol: "He", name: "Helium" }),
          ]),
      }),
    });

    const response = await request(app).get("/elements");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toMatchObject({
      symbol: "H",
      name: "Hydrogen",
      image: expect.objectContaining({
        title: expect.any(String),
      }),
      cpk_hex: expect.any(String),
    });
  });

  it("GET /elements returns sanitized error payload in production", async () => {
    const app = createExpressApp({
      appEnv: {
        ...appEnv,
        nodeEnv: "production",
      },
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockRejectedValue(new Error("repository failed")),
      }),
    });

    const response = await request(app).get("/elements");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        statusCode: 500,
        code: "LIST_ELEMENTS_FAILED",
        message: "Internal error while listing elements.",
      },
    });
  });

  it("GET /elements returns sanitized + detailed error payload in development", async () => {
    const app = createExpressApp({
      appEnv: {
        ...appEnv,
        nodeEnv: "development",
      },
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockRejectedValue(new Error("repository failed")),
      }),
    });

    const response = await request(app).get("/elements");

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      statusCode: 500,
      code: "LIST_ELEMENTS_FAILED",
      message: "Internal error while listing elements.",
    });
    expect(response.body.development).toMatchObject({
      message: "repository failed",
      layer: "application",
      name: "Error",
      stack: expect.any(String),
    });
  });

  it("returns structured 404 for unknown route", async () => {
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([]),
      }),
    });

    const response = await request(app).get("/unknown");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        statusCode: 404,
        code: "ROUTE_NOT_FOUND",
        message: "Not found",
      },
    });
  });
});

describe("Express auth integration", () => {
  it("returns 401 when token is missing", async () => {
    const validator: AuthTokenValidator = {
      validate: vi.fn().mockResolvedValue(true),
    };
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([makeElement({ symbol: "H" })]),
      }),
      authMiddleware: createRequireAuthMiddleware(validator),
    });

    const response = await request(app).get("/elements");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized." });
    expect(validator.validate).not.toHaveBeenCalled();
  });

  it("returns 200 when token is valid", async () => {
    const validator: AuthTokenValidator = {
      validate: vi.fn().mockResolvedValue(true),
    };
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([makeElement({ symbol: "H" })]),
      }),
      authMiddleware: createRequireAuthMiddleware(validator),
    });

    const response = await request(app)
      .get("/elements")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({ symbol: "H" });
    expect(validator.validate).toHaveBeenCalledWith("valid-token");
  });

  it("returns 401 when token is invalid", async () => {
    const validator: AuthTokenValidator = {
      validate: vi.fn().mockResolvedValue(false),
    };
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([makeElement({ symbol: "H" })]),
      }),
      authMiddleware: createRequireAuthMiddleware(validator),
    });

    const response = await request(app)
      .get("/elements")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized." });
  });

  it("returns 503 when auth microservice is unavailable", async () => {
    const validator: AuthTokenValidator = {
      validate: vi.fn().mockRejectedValue(new Error("auth unavailable")),
    };
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([makeElement({ symbol: "H" })]),
      }),
      authMiddleware: createRequireAuthMiddleware(validator),
    });

    const response = await request(app)
      .get("/elements")
      .set("Authorization", "Bearer any-token");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ message: "Authentication service unavailable." });
  });
});
