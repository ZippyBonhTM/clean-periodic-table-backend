import { Router, type Request, type RequestHandler } from "express";

import type ManagePublicArticles from "../../application/usecases/ManagePublicArticles.js";
import type ManageSavedArticles from "../../application/usecases/ManageSavedArticles.js";
import type ManageOwnedArticles from "../../application/usecases/ManageOwnedArticles.js";
import type { ArticleDetail, ArticleFeedItem, ArticleSummary } from "../../domain/Article.js";
import { AppError, isAppError } from "../errors/AppError.js";

type CreateArticleRoutesInput = {
  managePublicArticles?: ManagePublicArticles;
  manageSavedArticles?: ManageSavedArticles;
  manageOwnedArticles?: ManageOwnedArticles;
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

function getSlugParam(request: Request): string {
  const slug = request.params.slug;

  if (typeof slug !== "string" || slug.trim().length === 0) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ARTICLE_INPUT",
      message: "slug route param is required.",
      publicMessage: "slug route param is required.",
      layer: "http",
    });
  }

  return slug.trim();
}

function getHashtagParam(request: Request): string {
  const hashtag = request.params.hashtag;

  if (typeof hashtag !== "string" || hashtag.trim().length === 0) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ARTICLE_INPUT",
      message: "hashtag route param is required.",
      publicMessage: "hashtag route param is required.",
      layer: "http",
    });
  }

  return hashtag.trim();
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

function parseRequiredQueryString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ARTICLE_INPUT",
      message: `${field} query param is required.`,
      publicMessage: `${field} query param is required.`,
      layer: "http",
    });
  }

  return value.trim();
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

function toArticleFeedItemResponse(article: ArticleFeedItem) {
  return {
    ...toArticleSummaryResponse(article),
    relevanceScore: article.relevanceScore,
  };
}

function toArticleDetailResponse(article: ArticleDetail) {
  return {
    ...toArticleSummaryResponse(article),
    markdownSource: article.markdownSource,
  };
}

function createArticleRoutes({
  managePublicArticles,
  manageSavedArticles,
  manageOwnedArticles,
  authMiddleware,
  syncProductUserMiddleware,
}: CreateArticleRoutesInput): Router {
  const router = Router();
  const authHandlers = requireAuthenticationMiddleware(authMiddleware, syncProductUserMiddleware);

  if (managePublicArticles !== undefined) {
    router.get("/api/v1/feed", async (request, response, next) => {
      try {
        const result = await managePublicArticles.listGlobalFeed({
          cursor: parseOptionalString(request.query.cursor),
          limit: parseLimit(request.query.limit),
        });

        response.status(200).json({
          items: result.items.map((article) => toArticleFeedItemResponse(article)),
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
            code: "LIST_PUBLIC_FEED_FAILED",
            message: error instanceof Error ? error.message : String(error),
            publicMessage: "Internal error while listing article feed.",
            layer: "application",
            cause: error,
          }),
        );
      }
    });

    router.get("/api/v1/feed/hashtag/:hashtag", async (request, response, next) => {
      try {
        const result = await managePublicArticles.listHashtagFeed({
          hashtag: getHashtagParam(request),
          cursor: parseOptionalString(request.query.cursor),
          limit: parseLimit(request.query.limit),
        });

        response.status(200).json({
          items: result.items.map((article) => toArticleFeedItemResponse(article)),
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
            code: "LIST_HASHTAG_FEED_FAILED",
            message: error instanceof Error ? error.message : String(error),
            publicMessage: "Internal error while listing hashtag feed.",
            layer: "application",
            cause: error,
          }),
        );
      }
    });

    router.get("/api/v1/search", async (request, response, next) => {
      try {
        const result = await managePublicArticles.searchArticles({
          query: parseRequiredQueryString(request.query.q, "q"),
          cursor: parseOptionalString(request.query.cursor),
          limit: parseLimit(request.query.limit),
        });

        response.status(200).json({
          items: result.items.map((article) => toArticleFeedItemResponse(article)),
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
            code: "SEARCH_ARTICLES_FAILED",
            message: error instanceof Error ? error.message : String(error),
            publicMessage: "Internal error while searching articles.",
            layer: "application",
            cause: error,
          }),
        );
      }
    });

    router.get("/api/v1/articles/by-slug/:slug", async (request, response, next) => {
      try {
        const article = await managePublicArticles.getArticleBySlug(getSlugParam(request));
        response.status(200).json(toArticleDetailResponse(article));
      } catch (error: unknown) {
        if (isAppError(error)) {
          next(error);
          return;
        }

        next(
          new AppError({
            statusCode: 500,
            code: "GET_ARTICLE_BY_SLUG_FAILED",
            message: error instanceof Error ? error.message : String(error),
            publicMessage: "Internal error while loading the article.",
            layer: "application",
            cause: error,
          }),
        );
      }
    });

    router.get("/api/v1/hashtags", async (request, response, next) => {
      try {
        const result = await managePublicArticles.listHashtags({
          query: parseOptionalString(request.query.q),
          limit: parseLimit(request.query.limit),
        });

        response.status(200).json(result);
      } catch (error: unknown) {
        if (isAppError(error)) {
          next(error);
          return;
        }

        next(
          new AppError({
            statusCode: 500,
            code: "LIST_ARTICLE_HASHTAGS_FAILED",
            message: error instanceof Error ? error.message : String(error),
            publicMessage: "Internal error while listing article hashtags.",
            layer: "application",
            cause: error,
          }),
        );
      }
    });
  }

  if (manageOwnedArticles !== undefined) {
    router.get("/api/v1/me/articles", ...authHandlers, async (request, response, next) => {
      try {
        const result = await manageOwnedArticles.listOwnedArticles({
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
            code: "LIST_OWNED_ARTICLES_FAILED",
            message: error instanceof Error ? error.message : String(error),
            publicMessage: "Internal error while listing your articles.",
            layer: "application",
            cause: error,
          }),
        );
      }
    });
  }

  if (manageSavedArticles !== undefined) {
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
  }

  return router;
}

export { createArticleRoutes };
export type { CreateArticleRoutesInput };
