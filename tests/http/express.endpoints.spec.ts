import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import ListAllElements from "@/application/usecases/ListAllElements.js";
import type AuthTokenValidator from "@/application/protocols/AuthTokenValidator.js";
import type ElementRepository from "@/application/protocols/ElementRepository.js";
import type { AppEnv } from "@/config/env.js";
import Element from "@/domain/Element.js";
import { createExpressApp } from "@/http/createExpressApp.js";
import { createRequireAuthMiddleware } from "@/http/middlewares/requireAuth.js";

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

  it("GET /elements returns all elements", async () => {
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([new Element("H"), new Element("He")]),
      }),
    });

    const response = await request(app).get("/elements");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ symbol: "H" }, { symbol: "He" }]);
  });

  it("GET /elements returns 500 when use case fails", async () => {
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockRejectedValue(new Error("repository failed")),
      }),
    });

    const response = await request(app).get("/elements");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      message: "Internal error while listing elements.",
      error: "Error: repository failed",
    });
  });

  it("returns 404 for unknown route", async () => {
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([]),
      }),
    });

    const response = await request(app).get("/unknown");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Not found" });
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
        getAllElements: vi.fn().mockResolvedValue([new Element("H")]),
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
        getAllElements: vi.fn().mockResolvedValue([new Element("H")]),
      }),
      authMiddleware: createRequireAuthMiddleware(validator),
    });

    const response = await request(app)
      .get("/elements")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ symbol: "H" }]);
    expect(validator.validate).toHaveBeenCalledWith("valid-token");
  });

  it("returns 401 when token is invalid", async () => {
    const validator: AuthTokenValidator = {
      validate: vi.fn().mockResolvedValue(false),
    };
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([new Element("H")]),
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
        getAllElements: vi.fn().mockResolvedValue([new Element("H")]),
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
