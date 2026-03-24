import { Router, type Request, type RequestHandler } from "express";

import type ManageSavedArticles from "../../application/usecases/ManageSavedArticles.js";
import type { ArticleSummary } from "../../domain/Article.js";
import { AppError, isAppError } from "../errors/AppError.js";

type CreateArticleRoutesInput = {
  manageSavedArticles: ManageSavedArticles;
  authMiddleware?: RequestHandler;
  syncProductUserMiddleware?: RequestHandler;
};

function requireAuthenticationMiddleware(
  authMiddleware?: RequestHandler,
  syncProductUserMiddleware?: RequestHandler,
): RequestHandler[] {
  if (authMiddleware !== undefined) {
    return syncProductUserMiddleware !== undefined
      ? [authMiddleware, syncProductUserMiddleware]
      : [authMiddleware];
  }

  return [(_request, response) => {
    response.status(503).json({ message: "Article routes require authentication." });
  }];
}

function getAuthenticatedUserId(request: Request): string {
  const userId = request.auth?.userId;

  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new AppError({
      statusCode: 500,
      code: "AUTH_CONTEXT_MISSING",
      message: "Authenticated user context was not attached to the request.",
      publicMessage: "Authentication context missing.",
      layer: "http",
    });
  }

  return userId;
}

function getArticleIdParam(request: Request): string {
  const articleId = request.params.articleId;

  if (typeof articleId !== "string" || articleId.trim().length === 0) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ARTICLE_INPUT",
      message: "articleId route param is required.",
      publicMessage: "articleId route param is required.",
      layer: "http",
    });
  }

  return articleId.trim();
}

function parseLimit(value: unknown): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    return 20;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ARTICLE_INPUT",
      message: "limit must be an integer.",
      publicMessage: "limit must be an integer.",
      layer: "http",
    });
  }

  return parsed;
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toArticleSummaryResponse(article: ArticleSummary) {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    visibility: article.visibility,
    status: article.status,
    coverImage: article.coverImage,
    hashtags: article.hashtags.map((hashtag) => ({
      id: hashtag.id,
      name: hashtag.name,
    })),
    author: {
      id: article.author.id,
      displayName: article.author.displayName,
      username: article.author.username,
      profileImage: article.author.profileImage,
    },
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    publishedAt: article.publishedAt?.toISOString() ?? null,
  };
}

function createArticleRoutes({
  manageSavedArticles,
  authMiddleware,
  syncProductUserMiddleware,
}: CreateArticleRoutesInput): Router {
  const router = Router();
  const authHandlers = requireAuthenticationMiddleware(authMiddleware, syncProductUserMiddleware);

  router.get("/api/v1/me/articles/saved", ...authHandlers, async (request, response, next) => {
    try {
      const result = await manageSavedArticles.listSavedArticles({
        userId: getAuthenticatedUserId(request),
        cursor: parseOptionalString(request.query.cursor),
        limit: parseLimit(request.query.limit),
      });

      response.status(200).json({
        items: result.items.map((article) => toArticleSummaryResponse(article)),
        nextCursor: result.nextCursor,
      });
    } catch (error: unknown) {
      if (isAppError(error)) {
        next(error);
        return;
      }

      next(
        new AppError({
          statusCode: 500,
          code: "LIST_SAVED_ARTICLES_FAILED",
          message: error instanceof Error ? error.message : String(error),
          publicMessage: "Internal error while listing saved articles.",
          layer: "application",
          cause: error,
        }),
      );
    }
  });

  router.post("/api/v1/articles/:articleId/save", ...authHandlers, async (request, response, next) => {
    try {
      await manageSavedArticles.saveArticleForUser(
        getAuthenticatedUserId(request),
        getArticleIdParam(request),
      );

      response.status(204).send();
    } catch (error: unknown) {
      if (isAppError(error)) {
        next(error);
        return;
      }

      next(
        new AppError({
          statusCode: 500,
          code: "SAVE_ARTICLE_FAILED",
          message: error instanceof Error ? error.message : String(error),
          publicMessage: "Internal error while saving the article.",
          layer: "application",
          cause: error,
        }),
      );
    }
  });

  return router;
}

export { createArticleRoutes };
export type { CreateArticleRoutesInput };
