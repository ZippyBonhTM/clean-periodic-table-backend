import { randomUUID } from "node:crypto";

import type ArticleRepository from "../protocols/ArticleRepository.js";
import type {
  CreateOwnedArticleDraftInput,
  UpdateOwnedArticleInput,
} from "../protocols/ArticleRepository.js";
import type { ArticleAuthor, ArticleHashtag, ArticleVisibility } from "../../domain/Article.js";
import { AppError } from "../../http/errors/AppError.js";

type CreateDraftInput = {
  userId: string;
  title: string | undefined;
  markdownSource: string | undefined;
  excerpt: string | undefined;
  visibility: ArticleVisibility | undefined;
  coverImage: string | null | undefined;
  hashtags: string[] | undefined;
};

type UpdateArticleInput = {
  userId: string;
  articleId: string;
  title: string | undefined;
  markdownSource: string | undefined;
  excerpt: string | undefined;
  visibility: ArticleVisibility | undefined;
  coverImage: string | null | undefined;
  hashtags: string[] | undefined;
};

function normalizeString(value: string | undefined): string {
  return value ?? "";
}

function normalizeVisibility(value: ArticleVisibility | undefined): ArticleVisibility {
  if (value === "public" || value === "private") {
    return value;
  }

  return "private";
}

function normalizeAsciiToken(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildSlugCandidate(value: string): string {
  const normalized = normalizeAsciiToken(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "draft";
}

function normalizeHashtags(hashtags: string[] | undefined): ArticleHashtag[] {
  if (hashtags === undefined) {
    return [];
  }

  const normalized = hashtags
    .map((entry) => normalizeAsciiToken(entry).replace(/^#+/g, "").replace(/[^a-z0-9-]/g, ""))
    .map((entry) => entry.replace(/^-+|-+$/g, ""))
    .filter((entry) => entry.length > 0);
  const unique = Array.from(new Set(normalized)).slice(0, 10);

  return unique.map((entry) => ({
    id: entry,
    name: entry,
  }));
}

function buildAuthor(userId: string): ArticleAuthor {
  return {
    id: userId,
    displayName: null,
    username: null,
    profileImage: null,
  };
}

function createArticleNotFoundError(articleId: string): AppError {
  return new AppError({
    statusCode: 404,
    code: "ARTICLE_NOT_FOUND",
    message: `Article ${articleId} was not found for this user.`,
    publicMessage: "Requested article does not exist.",
    layer: "application",
  });
}

export default class ManageEditableArticles {
  constructor(private readonly repository: ArticleRepository) {}

  private async reserveUniqueSlug(
    baseSlug: string,
    excludeArticleId?: string | null,
  ): Promise<string> {
    let attempt = 0;

    while (attempt < 100) {
      const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${String(attempt + 1)}`;
      const available = await this.repository.isArticleSlugAvailable(candidate, excludeArticleId);

      if (available) {
        return candidate;
      }

      attempt += 1;
    }

    throw new AppError({
      statusCode: 409,
      code: "ARTICLE_SLUG_EXHAUSTED",
      message: `Could not reserve a unique slug for base ${baseSlug}.`,
      publicMessage: "Could not generate a unique article slug.",
      layer: "application",
    });
  }

  async createDraft(input: CreateDraftInput) {
    const articleId = randomUUID();
    const title = normalizeString(input.title);
    const markdownSource = normalizeString(input.markdownSource);
    const excerpt = normalizeString(input.excerpt);
    const visibility = normalizeVisibility(input.visibility);
    const hashtags = normalizeHashtags(input.hashtags);
    const slug = await this.reserveUniqueSlug(buildSlugCandidate(title));

    const repositoryInput: CreateOwnedArticleDraftInput = {
      userId: input.userId,
      articleId,
      title,
      slug,
      excerpt,
      markdownSource,
      visibility,
      coverImage: input.coverImage ?? null,
      hashtags,
      author: buildAuthor(input.userId),
    };

    return await this.repository.createOwnedArticleDraft(repositoryInput);
  }

  async getOwnedArticleById(userId: string, articleId: string) {
    const article = await this.repository.findOwnedArticleById(userId, articleId);

    if (article === null) {
      throw createArticleNotFoundError(articleId);
    }

    return article;
  }

  async updateOwnedArticle(input: UpdateArticleInput) {
    const existingArticle = await this.repository.findOwnedArticleById(input.userId, input.articleId);

    if (existingArticle === null) {
      throw createArticleNotFoundError(input.articleId);
    }

    const nextTitle = input.title ?? existingArticle.title;
    const nextSlug =
      input.title !== undefined
        ? await this.reserveUniqueSlug(buildSlugCandidate(nextTitle), existingArticle.id)
        : existingArticle.slug;

    const repositoryInput: UpdateOwnedArticleInput = {
      userId: input.userId,
      articleId: input.articleId,
      title: nextTitle,
      slug: nextSlug,
      excerpt: input.excerpt ?? existingArticle.excerpt,
      markdownSource: input.markdownSource ?? existingArticle.markdownSource,
      visibility: input.visibility ?? existingArticle.visibility,
      coverImage: input.coverImage !== undefined ? input.coverImage : existingArticle.coverImage,
      hashtags: input.hashtags !== undefined ? normalizeHashtags(input.hashtags) : existingArticle.hashtags,
    };

    const updatedArticle = await this.repository.updateOwnedArticle(repositoryInput);

    if (updatedArticle === null) {
      throw createArticleNotFoundError(input.articleId);
    }

    return updatedArticle;
  }
}
