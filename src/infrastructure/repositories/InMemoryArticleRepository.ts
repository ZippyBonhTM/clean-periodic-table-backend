import type ArticleRepository from "../../application/protocols/ArticleRepository.js";
import type {
  ListSavedArticlesInput,
  SaveArticleForUserInput,
} from "../../application/protocols/ArticleRepository.js";
import type { ArticleCursorPage, ArticleRecord, ArticleSummary } from "../../domain/Article.js";
import { clampPageSize, decodeCursor, encodeCursor } from "./adminCursor.js";

type SaveRecord = {
  userId: string;
  articleId: string;
  createdAt: Date;
};

function cloneArticleSummary(article: ArticleSummary): ArticleSummary {
  return structuredClone(article);
}

function compareSaveRecords(first: SaveRecord, second: SaveRecord): number {
  const dateDiff = second.createdAt.getTime() - first.createdAt.getTime();

  if (dateDiff !== 0) {
    return dateDiff;
  }

  return second.articleId.localeCompare(first.articleId);
}

export default class InMemoryArticleRepository implements ArticleRepository {
  private readonly articles = new Map<string, ArticleRecord>();

  private readonly saves = new Map<string, SaveRecord>();

  seedArticle(article: ArticleRecord): void {
    this.articles.set(article.id, structuredClone(article));
  }

  async findPublishedPublicById(articleId: string): Promise<ArticleSummary | null> {
    const article = this.articles.get(articleId);

    if (article === undefined || article.visibility !== "public" || article.status !== "published") {
      return null;
    }

    return cloneArticleSummary(article);
  }

  async listSavedArticles(input: ListSavedArticlesInput): Promise<ArticleCursorPage<ArticleSummary>> {
    const limit = clampPageSize(input.limit);
    const cursor = decodeCursor(input.cursor);
    const visibleSaves = [...this.saves.values()]
      .filter((save) => save.userId === input.userId)
      .sort(compareSaveRecords)
      .filter((save) => {
        const article = this.articles.get(save.articleId);

        return article !== undefined && article.visibility === "public" && article.status === "published";
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
