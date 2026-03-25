import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import ManageEditableArticles from "@/application/usecases/ManageEditableArticles.js";
import ManagePublicArticles from "@/application/usecases/ManagePublicArticles.js";
import ManageSavedArticles from "@/application/usecases/ManageSavedArticles.js";
import ManageOwnedArticles from "@/application/usecases/ManageOwnedArticles.js";
import ListAllElements from "@/application/usecases/ListAllElements.js";
import type ElementRepository from "@/application/protocols/ElementRepository.js";
import ManageUserMolecules from "@/application/usecases/ManageUserMolecules.js";
import type { AppEnv } from "@/config/env.js";
import { createApiRouter } from "@/http/routes/index.js";
import InMemoryArticleRepository from "@/infrastructure/repositories/InMemoryArticleRepository.js";
import InMemoryUserMoleculeRepository from "@/infrastructure/repositories/InMemoryUserMoleculeRepository.js";
import { makeElement } from "../../support/elementFixture.js";

const appEnv: AppEnv = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3333,
  mongoUri: null,
  dataSource: "memory",
  authRequired: false,
  authServiceUrl: null,
  authInternalServiceToken: null,
  authValidatePath: "/validate-token",
  authProfilePath: "/profile",
  authListUsersPath: null,
  authRevokeUserSessionsPath: null,
  adminBootstrapUserIds: [],
};

function makeListAllElements(repository: ElementRepository): ListAllElements {
  return new ListAllElements(repository);
}

function makeManageUserMolecules(): ManageUserMolecules {
  return new ManageUserMolecules(new InMemoryUserMoleculeRepository());
}

function makeManageSavedArticles(): ManageSavedArticles {
  return new ManageSavedArticles(new InMemoryArticleRepository());
}

function makeManagePublicArticles(): ManagePublicArticles {
  return new ManagePublicArticles(new InMemoryArticleRepository());
}

function makeManageEditableArticles(): ManageEditableArticles {
  return new ManageEditableArticles(new InMemoryArticleRepository());
}

function makeManageOwnedArticles(): ManageOwnedArticles {
  return new ManageOwnedArticles(new InMemoryArticleRepository());
}

describe("createApiRouter", () => {
  it("registers /health, /elements, /molecules, and article routes", async () => {
    const router = createApiRouter({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([makeElement({ symbol: "H" })]),
      }),
      manageEditableArticles: makeManageEditableArticles(),
      managePublicArticles: makeManagePublicArticles(),
      manageSavedArticles: makeManageSavedArticles(),
      manageOwnedArticles: makeManageOwnedArticles(),
      manageUserMolecules: makeManageUserMolecules(),
    });
    const app = express();
    app.use(router);

    const health = await request(app).get("/health");
    const elements = await request(app).get("/elements");
    const molecules = await request(app).get("/molecules");
    const feed = await request(app).get("/api/v1/feed");
    const createDraft = await request(app).post("/api/v1/articles");
    const ownedArticles = await request(app).get("/api/v1/me/articles");
    const savedArticles = await request(app).get("/api/v1/me/articles/saved");

    expect(health.status).toBe(200);
    expect(health.body).toEqual({
      status: "ok",
      env: "test",
      dataSource: "memory",
    });
    expect(elements.status).toBe(200);
    expect(elements.body[0]).toMatchObject({ symbol: "H" });
    expect(molecules.status).toBe(503);
    expect(molecules.body).toEqual({ message: "Molecule persistence requires authentication." });
    expect(feed.status).toBe(200);
    expect(feed.body).toEqual({ items: [], nextCursor: null });
    expect(createDraft.status).toBe(503);
    expect(createDraft.body).toEqual({ message: "Article routes require authentication." });
    expect(ownedArticles.status).toBe(503);
    expect(ownedArticles.body).toEqual({ message: "Article routes require authentication." });
    expect(savedArticles.status).toBe(503);
    expect(savedArticles.body).toEqual({ message: "Article routes require authentication." });
  });
});
