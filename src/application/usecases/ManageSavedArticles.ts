import type ArticleRepository from "../protocols/ArticleRepository.js";
import type { ListSavedArticlesInput } from "../protocols/ArticleRepository.js";
import { AppError } from "../../http/errors/AppError.js";

function createArticleNotFoundError(articleId: string): AppError {
  return new AppError({
    statusCode: 404,
    code: "ARTICLE_NOT_FOUND",
    message: `Article ${articleId} was not found or is not publicly available.`,
    publicMessage: "Requested article does not exist.",
    layer: "application",
  });
}

export default class ManageSavedArticles {
  constructor(private readonly repository: ArticleRepository) {}

  async listSavedArticles(input: ListSavedArticlesInput) {
    return await this.repository.listSavedArticles(input);
  }

  async saveArticleForUser(userId: string, articleId: string): Promise<void> {
    const article = await this.repository.findPublishedPublicById(articleId);

    if (article === null) {
      throw createArticleNotFoundError(articleId);
    }

    await this.repository.saveArticleForUser({
      userId,
      articleId,
    });
  }
}
