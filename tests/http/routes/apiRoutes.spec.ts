import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import ListAllElements from "@/application/usecases/ListAllElements.js";
import type ElementRepository from "@/application/protocols/ElementRepository.js";
import type { AppEnv } from "@/config/env.js";
import { createApiRouter } from "@/http/routes/index.js";
import { makeElement } from "../../support/elementFixture.js";

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

describe("createApiRouter", () => {
  it("registers /health and /elements routes", async () => {
    const router = createApiRouter({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([makeElement({ symbol: "H" })]),
      }),
    });
    const app = express();
    app.use(router);

    const health = await request(app).get("/health");
    const elements = await request(app).get("/elements");

    expect(health.status).toBe(200);
    expect(health.body).toEqual({
      status: "ok",
      env: "test",
      dataSource: "memory",
    });
    expect(elements.status).toBe(200);
    expect(elements.body[0]).toMatchObject({ symbol: "H" });
  });
});
