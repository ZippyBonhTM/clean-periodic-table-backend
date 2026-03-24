import type { ArticleCursorPage, ArticleSummary } from "../../domain/Article.js";

export type ListSavedArticlesInput = {
  userId: string;
  cursor?: string | null;
  limit?: number;
};

export type SaveArticleForUserInput = {
  userId: string;
  articleId: string;
  savedAt?: Date;
};

export default interface ArticleRepository {
  findPublishedPublicById(articleId: string): Promise<ArticleSummary | null>;
  listSavedArticles(input: ListSavedArticlesInput): Promise<ArticleCursorPage<ArticleSummary>>;
  saveArticleForUser(input: SaveArticleForUserInput): Promise<void>;
}
