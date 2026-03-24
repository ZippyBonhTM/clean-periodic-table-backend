import request from "supertest";
import { describe, expect, it } from "vitest";

import type AuthTokenValidator from "@/application/protocols/AuthTokenValidator.js";
import ListAllElements from "@/application/usecases/ListAllElements.js";
import ManageSavedArticles from "@/application/usecases/ManageSavedArticles.js";
import ManageUserMolecules from "@/application/usecases/ManageUserMolecules.js";
import type { ArticleRecord } from "@/domain/Article.js";
import type { AppEnv } from "@/config/env.js";
import { createExpressApp } from "@/http/createExpressApp.js";
import { createRequireAuthMiddleware } from "@/http/middlewares/requireAuth.js";
import InMemoryArticleRepository from "@/infrastructure/repositories/InMemoryArticleRepository.js";
import InMemoryElementRepository from "@/infrastructure/repositories/InMemoryElementRepository.js";
import InMemoryUserMoleculeRepository from "@/infrastructure/repositories/InMemoryUserMoleculeRepository.js";

const appEnv: AppEnv = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3333,
  mongoUri: null,
  dataSource: "memory",
  authRequired: true,
  authServiceUrl: "http://auth.internal",
  authInternalServiceToken: null,
  authValidatePath: "/validate-token",
  authProfilePath: "/profile",
  authListUsersPath: null,
  authRevokeUserSessionsPath: null,
  adminBootstrapUserIds: [],
};

function makeAuthMiddleware() {
  const validator: AuthTokenValidator = {
    async validate(accessToken: string) {
      if (accessToken.trim().length === 0) {
        return null;
      }

      return {
        userId: accessToken,
      };
    },
  };

  return createRequireAuthMiddleware(validator);
}

function makeArticle(
  overrides: Partial<ArticleRecord> & Pick<ArticleRecord, "id" | "slug">,
): ArticleRecord {
  return {
    id: overrides.id,
    title: overrides.title ?? `Article ${overrides.id}`,
    slug: overrides.slug,
    excerpt: overrides.excerpt ?? "Saved article excerpt",
    markdownSource: overrides.markdownSource ?? "# Saved Article",
    visibility: overrides.visibility ?? "public",
    status: overrides.status ?? "published",
    coverImage: overrides.coverImage ?? null,
    hashtags: overrides.hashtags ?? [],
    author: overrides.author ?? {
      id: "author-1",
      displayName: "Ada Lovelace",
      username: "ada",
      profileImage: null,
    },
    saveCount: overrides.saveCount ?? 0,
    createdAt: overrides.createdAt ?? new Date("2026-03-22T18:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-03-22T18:00:00.000Z"),
    publishedAt: overrides.publishedAt ?? new Date("2026-03-22T18:00:00.000Z"),
  };
}

function createArticleTestContext() {
  const articleRepository = new InMemoryArticleRepository();
  const app = createExpressApp({
    appEnv,
    listAllElements: new ListAllElements(new InMemoryElementRepository()),
    manageSavedArticles: new ManageSavedArticles(articleRepository),
    manageUserMolecules: new ManageUserMolecules(new InMemoryUserMoleculeRepository()),
    authMiddleware: makeAuthMiddleware(),
  });

  return {
    app,
    articleRepository,
  };
}

describe("article routes", () => {
  it("saves a public article and lists it in the current user library", async () => {
    const { app, articleRepository } = createArticleTestContext();

    articleRepository.seedArticle(
      makeArticle({
        id: "article-1",
        slug: "article-1",
      }),
    );

    const saveResponse = await request(app)
      .post("/api/v1/articles/article-1/save")
      .set("Authorization", "Bearer user-1");

    expect(saveResponse.status).toBe(204);

    const listResponse = await request(app)
      .get("/api/v1/me/articles/saved")
      .set("Authorization", "Bearer user-1");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      items: [
        expect.objectContaining({
          id: "article-1",
          slug: "article-1",
          status: "published",
          visibility: "public",
        }),
      ],
      nextCursor: null,
    });
  });

  it("keeps saves idempotent for the same article and user", async () => {
    const { app, articleRepository } = createArticleTestContext();

    articleRepository.seedArticle(
      makeArticle({
        id: "article-1",
        slug: "article-1",
      }),
    );

    await request(app)
      .post("/api/v1/articles/article-1/save")
      .set("Authorization", "Bearer user-1");
    await request(app)
      .post("/api/v1/articles/article-1/save")
      .set("Authorization", "Bearer user-1");

    const listResponse = await request(app)
      .get("/api/v1/me/articles/saved")
      .set("Authorization", "Bearer user-1");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);
  });

  it("rejects saving articles that are not publicly published", async () => {
    const { app, articleRepository } = createArticleTestContext();

    articleRepository.seedArticle(
      makeArticle({
        id: "article-private",
        slug: "article-private",
        visibility: "private",
      }),
    );

    const response = await request(app)
      .post("/api/v1/articles/article-private/save")
      .set("Authorization", "Bearer user-1");

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: "ARTICLE_NOT_FOUND",
      message: "Requested article does not exist.",
    });
  });

  it("paginates the saved article library by save timestamp", async () => {
    const { app, articleRepository } = createArticleTestContext();

    articleRepository.seedArticle(makeArticle({ id: "article-1", slug: "article-1" }));
    articleRepository.seedArticle(makeArticle({ id: "article-2", slug: "article-2" }));
    articleRepository.seedArticle(makeArticle({ id: "article-3", slug: "article-3" }));

    await articleRepository.saveArticleForUser({
      userId: "user-1",
      articleId: "article-1",
      savedAt: new Date("2026-03-22T18:00:00.000Z"),
    });
    await articleRepository.saveArticleForUser({
      userId: "user-1",
      articleId: "article-2",
      savedAt: new Date("2026-03-22T18:05:00.000Z"),
    });
    await articleRepository.saveArticleForUser({
      userId: "user-1",
      articleId: "article-3",
      savedAt: new Date("2026-03-22T18:10:00.000Z"),
    });

    const firstPage = await request(app)
      .get("/api/v1/me/articles/saved?limit=2")
      .set("Authorization", "Bearer user-1");

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.items[0]).toMatchObject({ id: "article-3" });
    expect(firstPage.body.items[1]).toMatchObject({ id: "article-2" });
    expect(typeof firstPage.body.nextCursor).toBe("string");

    const secondPage = await request(app)
      .get(`/api/v1/me/articles/saved?limit=2&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`)
      .set("Authorization", "Bearer user-1");

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.items[0]).toMatchObject({ id: "article-1" });
    expect(secondPage.body.nextCursor).toBeNull();
  });
});
