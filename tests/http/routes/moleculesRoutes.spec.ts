import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import ListAllElements from "@/application/usecases/ListAllElements.js";
import type AuthTokenValidator from "@/application/protocols/AuthTokenValidator.js";
import type ElementRepository from "@/application/protocols/ElementRepository.js";
import ManageUserMolecules from "@/application/usecases/ManageUserMolecules.js";
import type { AppEnv } from "@/config/env.js";
import { createExpressApp } from "@/http/createExpressApp.js";
import { createRequireAuthMiddleware } from "@/http/middlewares/requireAuth.js";
import InMemoryUserMoleculeRepository from "@/infrastructure/repositories/InMemoryUserMoleculeRepository.js";
import { makeSaveUserMoleculeInput } from "../../support/userMoleculeFixture.js";

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
  authRevokeUserSessionsPath: null,
  adminBootstrapUserIds: [],
};

function makeListAllElements(repository: ElementRepository): ListAllElements {
  return new ListAllElements(repository);
}

function makeApp(options: { validator?: AuthTokenValidator; repository?: InMemoryUserMoleculeRepository } = {}) {
  const repository = options.repository ?? new InMemoryUserMoleculeRepository();
  const manageUserMolecules = new ManageUserMolecules(repository);

  return createExpressApp({
    appEnv,
    listAllElements: makeListAllElements({
      getAllElements: vi.fn().mockResolvedValue([]),
    }),
    manageUserMolecules,
    ...(options.validator !== undefined
      ? { authMiddleware: createRequireAuthMiddleware(options.validator) }
      : {}),
  });
}

describe("Molecules routes", () => {
  it("requires authentication middleware for molecule persistence", async () => {
    const app = makeApp();

    const response = await request(app).get("/molecules");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ message: "Molecule persistence requires authentication." });
  });

  it("creates and lists saved molecules for the authenticated user", async () => {
    const repository = new InMemoryUserMoleculeRepository();
    const validator: AuthTokenValidator = {
      validate: vi.fn().mockResolvedValue({ userId: "user-1" }),
    };
    const app = makeApp({ validator, repository });
    const payload = makeSaveUserMoleculeInput();

    const createResponse = await request(app)
      .post("/molecules")
      .set("Authorization", "Bearer valid-token")
      .send(payload);

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      name: "Benzeno",
      educationalDescription: "Anel aromático clássico usado em química orgânica.",
      summary: {
        formula: expect.any(String),
        atomCount: 1,
        bondCount: 0,
      },
    });

    const listResponse = await request(app)
      .get("/molecules")
      .set("Authorization", "Bearer valid-token");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0]).toMatchObject({
      id: createResponse.body.id,
      summary: {
        formula: createResponse.body.summary.formula,
      },
    });
  });

  it("isolates molecules by authenticated user", async () => {
    const repository = new InMemoryUserMoleculeRepository();
    await repository.create(makeSaveUserMoleculeInput({ userId: "user-1", name: "Mol 1" }));
    await repository.create(makeSaveUserMoleculeInput({ userId: "user-2", name: "Mol 2" }));
    const validator: AuthTokenValidator = {
      validate: vi.fn().mockResolvedValue({ userId: "user-1" }),
    };
    const app = makeApp({ validator, repository });

    const response = await request(app)
      .get("/molecules")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ name: "Mol 1" });
  });

  it("updates and deletes a saved molecule", async () => {
    const repository = new InMemoryUserMoleculeRepository();
    const created = await repository.create(makeSaveUserMoleculeInput());
    const validator: AuthTokenValidator = {
      validate: vi.fn().mockResolvedValue({ userId: "user-1" }),
    };
    const app = makeApp({ validator, repository });

    const updateResponse = await request(app)
      .put(`/molecules/${created.id}`)
      .set("Authorization", "Bearer valid-token")
      .send({
        ...makeSaveUserMoleculeInput(),
        name: "Fenol",
        educationalDescription: "Grupo hidroxila ligado a um anel aromático.",
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      id: created.id,
      name: "Fenol",
      educationalDescription: "Grupo hidroxila ligado a um anel aromático.",
    });

    const deleteResponse = await request(app)
      .delete(`/molecules/${created.id}`)
      .set("Authorization", "Bearer valid-token");

    expect(deleteResponse.status).toBe(204);

    const listResponse = await request(app)
      .get("/molecules")
      .set("Authorization", "Bearer valid-token");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([]);
  });

  it("rejects invalid molecule payloads", async () => {
    const validator: AuthTokenValidator = {
      validate: vi.fn().mockResolvedValue({ userId: "user-1" }),
    };
    const app = makeApp({ validator });

    const response = await request(app)
      .post("/molecules")
      .set("Authorization", "Bearer valid-token")
      .send({
        name: "Broken",
        molecule: {
          atoms: [
            {
              id: "atom-1",
              x: 0,
              y: 0,
              element: {
                number: 6,
                symbol: "C",
                name: "Carbon",
                category: "nonmetal",
                group: 14,
                shells: [2, 4],
              },
            },
          ],
          bonds: [
            {
              id: "bond-1",
              sourceId: "atom-1",
              targetId: "missing-atom",
              order: 1,
            },
          ],
        },
        editorState: {
          selectedAtomId: null,
          activeView: "editor",
          bondOrder: 1,
          canvasViewport: {
            offsetX: 0,
            offsetY: 0,
            scale: 1,
          },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        statusCode: 400,
        code: "INVALID_MOLECULE_PAYLOAD",
        message: "Bond bond-1 references an unknown atom.",
      },
    });
  });
});
