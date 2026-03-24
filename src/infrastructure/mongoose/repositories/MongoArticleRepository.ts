import type ArticleRepository from "../../../application/protocols/ArticleRepository.js";
import type {
  ListSavedArticlesInput,
  SaveArticleForUserInput,
} from "../../../application/protocols/ArticleRepository.js";
import type { ArticleCursorPage, ArticleRecord, ArticleSummary } from "../../../domain/Article.js";
import { clampPageSize, decodeCursor, encodeCursor } from "../../repositories/adminCursor.js";
import ArticleModel from "../models/ArticleModel.js";
import type { ArticleDocument } from "../models/ArticleModel.js";
import ArticleSaveModel from "../models/ArticleSaveModel.js";

type StoredArticleDocument = ArticleDocument;

type SavedArticleAggregateDocument = {
  createdAt: Date;
  articleId: string;
  article: StoredArticleDocument;
};

function mapArticleSummary(document: StoredArticleDocument): ArticleSummary {
  return {
    id: document.id,
    title: document.title,
    slug: document.slug,
    excerpt: document.excerpt,
    visibility: document.visibility,
    status: document.status,
    coverImage: document.coverImage,
    hashtags: document.hashtags.map((hashtag) => ({
      id: hashtag.id,
      name: hashtag.name,
    })),
    author: {
      id: document.author.id,
      displayName: document.author.displayName,
      username: document.author.username,
      profileImage: document.author.profileImage,
    },
    createdAt: new Date(document.createdAt),
    updatedAt: new Date(document.updatedAt),
    publishedAt: document.publishedAt === null ? null : new Date(document.publishedAt),
  };
}

export default class MongoArticleRepository implements ArticleRepository {
  async findPublishedPublicById(articleId: string): Promise<ArticleSummary | null> {
    const article = (await ArticleModel.findOne(
      { id: articleId, visibility: "public", status: "published" },
      { __v: 0 },
    )
      .lean()
      .exec()) as StoredArticleDocument | null;

    return article === null ? null : mapArticleSummary(article);
  }

  async listSavedArticles(input: ListSavedArticlesInput): Promise<ArticleCursorPage<ArticleSummary>> {
    const limit = clampPageSize(input.limit);
    const cursor = decodeCursor(input.cursor);
    const match: Record<string, unknown> = {
      userId: input.userId,
    };

    if (cursor !== null) {
      const cursorDate = new Date(cursor.value);

      if (!Number.isNaN(cursorDate.getTime())) {
        match.$or = [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, articleId: { $lt: cursor.id } },
        ];
      }
    }

    const documents = await ArticleSaveModel.aggregate<SavedArticleAggregateDocument>([
      { $match: match },
      { $sort: { createdAt: -1, articleId: -1 } },
      {
        $lookup: {
          from: "articles",
          localField: "articleId",
          foreignField: "id",
          as: "article",
        },
      },
      { $unwind: "$article" },
      { $match: { "article.visibility": "public", "article.status": "published" } },
      { $limit: limit + 1 },
      {
        $project: {
          _id: 0,
          createdAt: 1,
          articleId: 1,
          article: 1,
        },
      },
    ]).exec();

    const pageItems = documents.slice(0, limit);
    const lastItem = pageItems[pageItems.length - 1];

    return {
      items: pageItems.map((entry) => mapArticleSummary(entry.article)),
      nextCursor:
        documents.length > limit && lastItem !== undefined
          ? encodeCursor({ value: new Date(lastItem.createdAt).toISOString(), id: lastItem.articleId })
          : null,
      prevCursor: null,
    };
  }

  async saveArticleForUser(input: SaveArticleForUserInput): Promise<void> {
    const result = await ArticleSaveModel.updateOne(
      {
        userId: input.userId,
        articleId: input.articleId,
      },
      {
        $setOnInsert: {
          userId: input.userId,
          articleId: input.articleId,
          createdAt: input.savedAt ?? new Date(),
        },
      },
      { upsert: true },
    ).exec();

    if (result.upsertedCount > 0) {
      await ArticleModel.updateOne({ id: input.articleId }, { $inc: { saveCount: 1 } }).exec();
    }
  }
}
