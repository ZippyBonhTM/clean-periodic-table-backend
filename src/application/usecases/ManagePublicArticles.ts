import type ArticleRepository from "../protocols/ArticleRepository.js";
import type {
  ListPublicArticlesByHashtagInput,
  ListPublicArticlesInput,
  ListPublicHashtagsInput,
  SearchPublicArticlesInput,
} from "../protocols/ArticleRepository.js";
import { AppError } from "../../http/errors/AppError.js";

function createArticleNotFoundError(slug: string): AppError {
  return new AppError({
    statusCode: 404,
    code: "ARTICLE_NOT_FOUND",
    message: `Article ${slug} was not found or is not publicly available.`,
    publicMessage: "Requested article does not exist.",
    layer: "application",
  });
}

function assertNonEmptyTrimmedString(value: string, field: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ARTICLE_INPUT",
      message: `${field} must not be empty.`,
      publicMessage: `${field} must not be empty.`,
      layer: "application",
    });
  }

  return trimmed;
}

export default class ManagePublicArticles {
  constructor(private readonly repository: ArticleRepository) {}

  async listGlobalFeed(input: ListPublicArticlesInput) {
    return await this.repository.listPublicFeed(input);
  }

  async listHashtagFeed(input: ListPublicArticlesByHashtagInput) {
    return await this.repository.listPublicFeedByHashtag({
      ...input,
      hashtag: assertNonEmptyTrimmedString(input.hashtag, "hashtag"),
    });
  }

  async searchArticles(input: SearchPublicArticlesInput) {
    return await this.repository.searchPublishedPublicArticles({
      ...input,
      query: assertNonEmptyTrimmedString(input.query, "query"),
    });
  }

  async getArticleBySlug(slug: string) {
    const normalizedSlug = assertNonEmptyTrimmedString(slug, "slug");
    const article = await this.repository.findPublishedPublicBySlug(normalizedSlug);

    if (article === null) {
      throw createArticleNotFoundError(normalizedSlug);
    }

    return article;
  }

  async listHashtags(input: ListPublicHashtagsInput = {}) {
    return await this.repository.listPublicHashtags({
      ...input,
      query: input.query?.trim() ?? null,
    });
  }
}
