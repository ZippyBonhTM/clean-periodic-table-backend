import type {
  ArticleCursorPage,
  ArticleDetail,
  ArticleFeedItem,
  ArticleHashtag,
  ArticleSummary,
} from "../../domain/Article.js";

export type ListPublicArticlesInput = {
  cursor?: string | null;
  limit?: number;
};

export type ListPublicArticlesByHashtagInput = ListPublicArticlesInput & {
  hashtag: string;
};

export type SearchPublicArticlesInput = ListPublicArticlesInput & {
  query: string;
};

export type ListPublicHashtagsInput = {
  query?: string | null;
  limit?: number;
};

export type ListSavedArticlesInput = {
  userId: string;
  cursor?: string | null;
  limit?: number;
};

export type ListOwnedArticlesInput = {
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
  findPublishedPublicBySlug(slug: string): Promise<ArticleDetail | null>;
  listPublicFeed(input: ListPublicArticlesInput): Promise<ArticleCursorPage<ArticleFeedItem>>;
  listPublicFeedByHashtag(
    input: ListPublicArticlesByHashtagInput,
  ): Promise<ArticleCursorPage<ArticleFeedItem>>;
  searchPublishedPublicArticles(
    input: SearchPublicArticlesInput,
  ): Promise<ArticleCursorPage<ArticleFeedItem>>;
  listPublicHashtags(input: ListPublicHashtagsInput): Promise<ArticleHashtag[]>;
  listOwnedArticles(input: ListOwnedArticlesInput): Promise<ArticleCursorPage<ArticleSummary>>;
  listSavedArticles(input: ListSavedArticlesInput): Promise<ArticleCursorPage<ArticleSummary>>;
  saveArticleForUser(input: SaveArticleForUserInput): Promise<void>;
}
