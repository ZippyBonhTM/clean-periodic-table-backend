import type {
  ArticleCursorPage,
  ArticleHashtag,
  ArticleDetail,
  ArticleAuthor,
  ArticleVisibility,
  ArticleFeedItem,
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

export type CreateOwnedArticleDraftInput = {
  userId: string;
  articleId: string;
  title: string;
  slug: string;
  excerpt: string;
  markdownSource: string;
  visibility: ArticleVisibility;
  coverImage: string | null;
  hashtags: ArticleHashtag[];
  author: ArticleAuthor;
};

export type UpdateOwnedArticleInput = {
  userId: string;
  articleId: string;
  title: string;
  slug: string;
  excerpt: string;
  markdownSource: string;
  visibility: ArticleVisibility;
  coverImage: string | null;
  hashtags: ArticleHashtag[];
};

export default interface ArticleRepository {
  findPublishedPublicById(articleId: string): Promise<ArticleSummary | null>;
  findPublishedPublicBySlug(slug: string): Promise<ArticleDetail | null>;
  findOwnedArticleById(userId: string, articleId: string): Promise<ArticleDetail | null>;
  isArticleSlugAvailable(slug: string, excludeArticleId?: string | null): Promise<boolean>;
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
  createOwnedArticleDraft(input: CreateOwnedArticleDraftInput): Promise<ArticleDetail>;
  updateOwnedArticle(input: UpdateOwnedArticleInput): Promise<ArticleDetail | null>;
  saveArticleForUser(input: SaveArticleForUserInput): Promise<void>;
}
