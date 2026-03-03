import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { AppError } from "@/http/errors/AppError.js";
import { createErrorHandlingMiddleware } from "@/http/middlewares/errorHandling.js";

function createTestApp(nodeEnv: "development" | "production") {
  const app = express();

  app.get("/app-error", (_request, _response, next) => {
    next(
      new AppError({
        statusCode: 422,
        code: "DOMAIN_VALIDATION_FAILED",
        message: "Element payload is invalid.",
        publicMessage: "Invalid element data.",
        layer: "domain",
        details: { field: "atomic_mass" },
      }),
    );
  });

  app.get("/generic-error", () => {
    throw new Error("database timeout");
  });

  app.use(createErrorHandlingMiddleware({ nodeEnv }));

  return app;
}

describe("createErrorHandlingMiddleware", () => {
  it("returns sanitized payload in production for AppError", async () => {
    const app = createTestApp("production");

    const response = await request(app).get("/app-error");

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: {
        statusCode: 422,
        code: "DOMAIN_VALIDATION_FAILED",
        message: "Invalid element data.",
      },
    });
  });

  it("returns fallback internal error shape in production for unknown errors", async () => {
    const app = createTestApp("production");

    const response = await request(app).get("/generic-error");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        statusCode: 500,
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
      },
    });
  });

  it("returns production + development blocks in development mode", async () => {
    const app = createTestApp("development");

    const response = await request(app).get("/app-error");

    expect(response.status).toBe(422);
    expect(response.body.error).toEqual({
      statusCode: 422,
      code: "DOMAIN_VALIDATION_FAILED",
      message: "Invalid element data.",
    });
    expect(response.body.development).toMatchObject({
      statusCode: 422,
      code: "DOMAIN_VALIDATION_FAILED",
      layer: "domain",
      message: "Element payload is invalid.",
      details: { field: "atomic_mass" },
      stack: expect.any(String),
    });
  });
});
