import type ArticleRepository from "../../application/protocols/ArticleRepository.js";
import type {
  ListPublicArticlesByHashtagInput,
  ListPublicArticlesInput,
  ListPublicHashtagsInput,
  ListSavedArticlesInput,
  SaveArticleForUserInput,
  SearchPublicArticlesInput,
} from "../../application/protocols/ArticleRepository.js";
import type {
  ArticleCursorPage,
  ArticleDetail,
  ArticleFeedItem,
  ArticleHashtag,
  ArticleRecord,
  ArticleSummary,
} from "../../domain/Article.js";
import { decodeCursor, encodeCursor, escapeRegExp } from "./adminCursor.js";
import {
  clampPageSize,
  decodeArticleSearchCursor,
  encodeArticleSearchCursor,
} from "./articleFeedCursor.js";

type SaveRecord = {
  userId: string;
  articleId: string;
  createdAt: Date;
};

type SearchResult = {
  article: ArticleRecord;
  relevanceScore: number;
};

function cloneArticleSummary(article: ArticleSummary): ArticleSummary {
  return structuredClone(article);
}

function cloneArticleDetail(article: ArticleRecord): ArticleDetail {
  return structuredClone({
    ...cloneArticleSummary(article),
    markdownSource: article.markdownSource,
  });
}

function toFeedItem(article: ArticleRecord, relevanceScore: number | null): ArticleFeedItem {
  return structuredClone({
    ...cloneArticleSummary(article),
    relevanceScore,
  });
}

function getArticleOrderDate(article: ArticleSummary): Date {
  return article.publishedAt ?? article.createdAt;
}

function isPublishedPublicArticle(article: ArticleSummary): boolean {
  return article.visibility === "public" && article.status === "published";
}

function compareSaveRecords(first: SaveRecord, second: SaveRecord): number {
  const dateDiff = second.createdAt.getTime() - first.createdAt.getTime();

  if (dateDiff !== 0) {
    return dateDiff;
  }

  return second.articleId.localeCompare(first.articleId);
}

function compareFeedArticles(first: ArticleRecord, second: ArticleRecord): number {
  const dateDiff = getArticleOrderDate(second).getTime() - getArticleOrderDate(first).getTime();

  if (dateDiff !== 0) {
    return dateDiff;
  }

  return second.id.localeCompare(first.id);
}

function compareSearchResults(first: SearchResult, second: SearchResult): number {
  const scoreDiff = second.relevanceScore - first.relevanceScore;

  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  return compareFeedArticles(first.article, second.article);
}

function matchesHashtag(article: ArticleRecord, hashtag: string): boolean {
  const matcher = new RegExp(`^${escapeRegExp(hashtag)}$`, "i");
  return article.hashtags.some((entry) => matcher.test(entry.name));
}

function scoreArticleSearch(article: ArticleRecord, query: string): number {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (normalizedQuery.length === 0) {
    return 0;
  }

  let score = 0;
  const title = article.title.toLocaleLowerCase();
  const excerpt = article.excerpt.toLocaleLowerCase();
  const markdown = article.markdownSource.toLocaleLowerCase();

  if (title.includes(normalizedQuery)) {
    score += 12;
  }

  if (excerpt.includes(normalizedQuery)) {
    score += 6;
  }

  if (markdown.includes(normalizedQuery)) {
    score += 3;
  }

  if (article.hashtags.some((entry) => entry.name.toLocaleLowerCase().includes(normalizedQuery))) {
    score += 8;
  }

  return score;
}

export default class InMemoryArticleRepository implements ArticleRepository {
  private readonly articles = new Map<string, ArticleRecord>();

  private readonly saves = new Map<string, SaveRecord>();

  seedArticle(article: ArticleRecord): void {
    this.articles.set(article.id, structuredClone(article));
  }

  async findPublishedPublicById(articleId: string): Promise<ArticleSummary | null> {
    const article = this.articles.get(articleId);

    if (article === undefined || !isPublishedPublicArticle(article)) {
      return null;
    }

    return cloneArticleSummary(article);
  }

  async findPublishedPublicBySlug(slug: string): Promise<ArticleDetail | null> {
    const article = [...this.articles.values()].find(
      (entry) => entry.slug === slug && isPublishedPublicArticle(entry),
    );

    return article === undefined ? null : cloneArticleDetail(article);
  }

  async listPublicFeed(input: ListPublicArticlesInput): Promise<ArticleCursorPage<ArticleFeedItem>> {
    const limit = clampPageSize(input.limit);
    const cursor = decodeCursor(input.cursor);
    const visibleArticles = [...this.articles.values()]
      .filter((article) => isPublishedPublicArticle(article))
      .sort(compareFeedArticles);

    const pagedArticles =
      cursor === null
        ? visibleArticles
        : visibleArticles.filter((article) => {
            const timestamp = getArticleOrderDate(article).toISOString();

            if (timestamp === cursor.value) {
              return article.id.localeCompare(cursor.id) < 0;
            }

            return timestamp.localeCompare(cursor.value) < 0;
          });

    const items = pagedArticles.slice(0, limit + 1);
    const pageItems = items.slice(0, limit);
    const lastArticle = pageItems[pageItems.length - 1];

    return {
      items: pageItems.map((article) => toFeedItem(article, null)),
      nextCursor:
        items.length > limit && lastArticle !== undefined
          ? encodeCursor({ value: getArticleOrderDate(lastArticle).toISOString(), id: lastArticle.id })
          : null,
      prevCursor: null,
    };
  }

  async listPublicFeedByHashtag(
    input: ListPublicArticlesByHashtagInput,
  ): Promise<ArticleCursorPage<ArticleFeedItem>> {
    const limit = clampPageSize(input.limit);
    const cursor = decodeCursor(input.cursor);
    const visibleArticles = [...this.articles.values()]
      .filter((article) => isPublishedPublicArticle(article) && matchesHashtag(article, input.hashtag))
      .sort(compareFeedArticles);

    const pagedArticles =
      cursor === null
        ? visibleArticles
        : visibleArticles.filter((article) => {
            const timestamp = getArticleOrderDate(article).toISOString();

            if (timestamp === cursor.value) {
              return article.id.localeCompare(cursor.id) < 0;
            }

            return timestamp.localeCompare(cursor.value) < 0;
          });

    const items = pagedArticles.slice(0, limit + 1);
    const pageItems = items.slice(0, limit);
    const lastArticle = pageItems[pageItems.length - 1];

    return {
      items: pageItems.map((article) => toFeedItem(article, null)),
      nextCursor:
        items.length > limit && lastArticle !== undefined
          ? encodeCursor({ value: getArticleOrderDate(lastArticle).toISOString(), id: lastArticle.id })
          : null,
      prevCursor: null,
    };
  }

  async searchPublishedPublicArticles(
    input: SearchPublicArticlesInput,
  ): Promise<ArticleCursorPage<ArticleFeedItem>> {
    const limit = clampPageSize(input.limit);
    const cursor = decodeArticleSearchCursor(input.cursor);
    const results = [...this.articles.values()]
      .filter((article) => isPublishedPublicArticle(article))
      .map((article) => ({ article, relevanceScore: scoreArticleSearch(article, input.query) }))
      .filter((entry) => entry.relevanceScore > 0)
      .sort(compareSearchResults);

    const pagedResults =
      cursor === null
        ? results
        : results.filter((entry) => {
            if (entry.relevanceScore < cursor.score) {
              return true;
            }

            if (entry.relevanceScore > cursor.score) {
              return false;
            }

            const timestamp = getArticleOrderDate(entry.article).toISOString();

            if (timestamp === cursor.publishedAt) {
              return entry.article.id.localeCompare(cursor.id) < 0;
            }

            return timestamp.localeCompare(cursor.publishedAt) < 0;
          });

    const items = pagedResults.slice(0, limit + 1);
    const pageItems = items.slice(0, limit);
    const lastResult = pageItems[pageItems.length - 1];

    return {
      items: pageItems.map((entry) => toFeedItem(entry.article, entry.relevanceScore)),
      nextCursor:
        items.length > limit && lastResult !== undefined
          ? encodeArticleSearchCursor({
              score: lastResult.relevanceScore,
              publishedAt: getArticleOrderDate(lastResult.article).toISOString(),
              id: lastResult.article.id,
            })
          : null,
      prevCursor: null,
    };
  }

  async listPublicHashtags(input: ListPublicHashtagsInput): Promise<ArticleHashtag[]> {
    const limit = clampPageSize(input.limit, 10, 20);
    const normalizedQuery = input.query?.trim().toLocaleLowerCase() ?? "";
    const hashtags = new Map<string, { hashtag: ArticleHashtag; articleCount: number }>();

    for (const article of this.articles.values()) {
      if (!isPublishedPublicArticle(article)) {
        continue;
      }

      for (const hashtag of article.hashtags) {
        if (
          normalizedQuery.length > 0 &&
          !hashtag.name.toLocaleLowerCase().includes(normalizedQuery)
        ) {
          continue;
        }

        const current = hashtags.get(hashtag.id);

        if (current === undefined) {
          hashtags.set(hashtag.id, {
            hashtag: structuredClone(hashtag),
            articleCount: 1,
          });
          continue;
        }

        current.articleCount += 1;
      }
    }

    return [...hashtags.values()]
      .sort((first, second) => {
        if (second.articleCount !== first.articleCount) {
          return second.articleCount - first.articleCount;
        }

        return first.hashtag.name.localeCompare(second.hashtag.name);
      })
      .slice(0, limit)
      .map((entry) => entry.hashtag);
  }

  async listSavedArticles(input: ListSavedArticlesInput): Promise<ArticleCursorPage<ArticleSummary>> {
    const limit = clampPageSize(input.limit);
    const cursor = decodeCursor(input.cursor);
    const visibleSaves = [...this.saves.values()]
      .filter((save) => save.userId === input.userId)
      .sort(compareSaveRecords)
      .filter((save) => {
        const article = this.articles.get(save.articleId);

        return article !== undefined && isPublishedPublicArticle(article);
      });

    const pagedSaves =
      cursor === null
        ? visibleSaves
        : visibleSaves.filter((save) => {
            const timestamp = save.createdAt.toISOString();

            if (timestamp === cursor.value) {
              return save.articleId.localeCompare(cursor.id) < 0;
            }

            return timestamp.localeCompare(cursor.value) < 0;
          });

    const items = pagedSaves
      .slice(0, limit + 1)
      .map((save) => this.articles.get(save.articleId))
      .filter((article): article is ArticleRecord => article !== undefined);
    const pageItems = items.slice(0, limit);
    const lastSave = pagedSaves[Math.min(limit, pagedSaves.length) - 1];

    return {
      items: pageItems.map((article) => cloneArticleSummary(article)),
      nextCursor:
        items.length > limit && lastSave !== undefined
          ? encodeCursor({ value: lastSave.createdAt.toISOString(), id: lastSave.articleId })
          : null,
      prevCursor: null,
    };
  }

  async saveArticleForUser(input: SaveArticleForUserInput): Promise<void> {
    const article = this.articles.get(input.articleId);

    if (article === undefined) {
      return;
    }

    const key = `${input.userId}:${input.articleId}`;

    if (this.saves.has(key)) {
      return;
    }

    this.saves.set(key, {
      userId: input.userId,
      articleId: input.articleId,
      createdAt: input.savedAt ?? new Date(),
    });
    this.articles.set(input.articleId, {
      ...article,
      saveCount: article.saveCount + 1,
    });
  }
}
