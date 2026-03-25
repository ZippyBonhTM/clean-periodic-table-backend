import type { PipelineStage } from "mongoose";

import type ArticleRepository from "../../../application/protocols/ArticleRepository.js";
import type {
  ListPublicArticlesByHashtagInput,
  ListPublicArticlesInput,
  ListPublicHashtagsInput,
  ListSavedArticlesInput,
  SaveArticleForUserInput,
  SearchPublicArticlesInput,
} from "../../../application/protocols/ArticleRepository.js";
import type {
  ArticleCursorPage,
  ArticleDetail,
  ArticleFeedItem,
  ArticleHashtag,
  ArticleSummary,
} from "../../../domain/Article.js";
import { decodeCursor, encodeCursor, escapeRegExp } from "../../repositories/adminCursor.js";
import {
  clampPageSize,
  decodeArticleSearchCursor,
  encodeArticleSearchCursor,
} from "../../repositories/articleFeedCursor.js";
import ArticleModel from "../models/ArticleModel.js";
import type { ArticleDocument } from "../models/ArticleModel.js";
import ArticleSaveModel from "../models/ArticleSaveModel.js";

type StoredArticleDocument = ArticleDocument;

type StoredArticleDetailDocument = StoredArticleDocument;

type FeedAggregateDocument = StoredArticleDocument & {
  feedDate: Date;
  relevanceScore?: number | null;
};

type HashtagAggregateDocument = {
  id: string;
  name: string;
  articleCount: number;
};

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

function mapArticleDetail(document: StoredArticleDetailDocument): ArticleDetail {
  return {
    ...mapArticleSummary(document),
    markdownSource: document.markdownSource,
  };
}

function mapArticleFeedItem(document: FeedAggregateDocument): ArticleFeedItem {
  return {
    ...mapArticleSummary(document),
    relevanceScore: document.relevanceScore ?? null,
  };
}

function createPublicFeedProjection() {
  return {
    _id: 0,
    id: 1,
    title: 1,
    slug: 1,
    excerpt: 1,
    visibility: 1,
    status: 1,
    coverImage: 1,
    hashtags: 1,
    author: 1,
    createdAt: 1,
    updatedAt: 1,
    publishedAt: 1,
    feedDate: {
      $ifNull: ["$publishedAt", "$createdAt"],
    },
  };
}

function createSearchScoreProjection(normalizedQuery: string) {
  return {
    ...createPublicFeedProjection(),
    relevanceScore: {
      $add: [
        {
          $cond: [{ $regexMatch: { input: "$title", regex: normalizedQuery, options: "i" } }, 12, 0],
        },
        {
          $cond: [{ $regexMatch: { input: "$excerpt", regex: normalizedQuery, options: "i" } }, 6, 0],
        },
        {
          $cond: [
            { $regexMatch: { input: "$markdownSource", regex: normalizedQuery, options: "i" } },
            3,
            0,
          ],
        },
        {
          $cond: [
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: "$hashtags",
                      as: "hashtag",
                      cond: {
                        $regexMatch: {
                          input: "$$hashtag.name",
                          regex: normalizedQuery,
                          options: "i",
                        },
                      },
                    },
                  },
                },
                0,
              ],
            },
            8,
            0,
          ],
        },
      ],
    },
  };
}

function createPublicArticleMatch() {
  return {
    visibility: "public",
    status: "published",
  };
}

export default class MongoArticleRepository implements ArticleRepository {
  async findPublishedPublicById(articleId: string): Promise<ArticleSummary | null> {
    const article = (await ArticleModel.findOne(
      { id: articleId, visibility: "public", status: "published" },
      { __v: 0, _id: 0 },
    )
      .lean()
      .exec()) as StoredArticleDocument | null;

    return article === null ? null : mapArticleSummary(article);
  }

  async findPublishedPublicBySlug(slug: string): Promise<ArticleDetail | null> {
    const article = (await ArticleModel.findOne(
      { slug, visibility: "public", status: "published" },
      { __v: 0, _id: 0 },
    )
      .lean()
      .exec()) as StoredArticleDetailDocument | null;

    return article === null ? null : mapArticleDetail(article);
  }

  async listPublicFeed(input: ListPublicArticlesInput): Promise<ArticleCursorPage<ArticleFeedItem>> {
    const limit = clampPageSize(input.limit);
    const cursor = decodeCursor(input.cursor);
    const pipeline: PipelineStage[] = [
      { $match: createPublicArticleMatch() },
      { $project: createPublicFeedProjection() },
    ];

    if (cursor !== null) {
      const cursorDate = new Date(cursor.value);

      if (!Number.isNaN(cursorDate.getTime())) {
        pipeline.push({
          $match: {
            $or: [
              { feedDate: { $lt: cursorDate } },
              { feedDate: cursorDate, id: { $lt: cursor.id } },
            ],
          },
        });
      }
    }

    pipeline.push(
      { $sort: { feedDate: -1, id: -1 } },
      { $limit: limit + 1 },
    );

    const documents = await ArticleModel.aggregate<FeedAggregateDocument>(pipeline).exec();
    const pageItems = documents.slice(0, limit);
    const lastItem = pageItems[pageItems.length - 1];

    return {
      items: pageItems.map((entry) => mapArticleFeedItem(entry)),
      nextCursor:
        documents.length > limit && lastItem !== undefined
          ? encodeCursor({ value: new Date(lastItem.feedDate).toISOString(), id: lastItem.id })
          : null,
      prevCursor: null,
    };
  }

  async listPublicFeedByHashtag(
    input: ListPublicArticlesByHashtagInput,
  ): Promise<ArticleCursorPage<ArticleFeedItem>> {
    const limit = clampPageSize(input.limit);
    const cursor = decodeCursor(input.cursor);
    const pipeline: PipelineStage[] = [
      {
        $match: {
          ...createPublicArticleMatch(),
          "hashtags.name": {
            $regex: `^${escapeRegExp(input.hashtag)}$`,
            $options: "i",
          },
        },
      },
      { $project: createPublicFeedProjection() },
    ];

    if (cursor !== null) {
      const cursorDate = new Date(cursor.value);

      if (!Number.isNaN(cursorDate.getTime())) {
        pipeline.push({
          $match: {
            $or: [
              { feedDate: { $lt: cursorDate } },
              { feedDate: cursorDate, id: { $lt: cursor.id } },
            ],
          },
        });
      }
    }

    pipeline.push(
      { $sort: { feedDate: -1, id: -1 } },
      { $limit: limit + 1 },
    );

    const documents = await ArticleModel.aggregate<FeedAggregateDocument>(pipeline).exec();
    const pageItems = documents.slice(0, limit);
    const lastItem = pageItems[pageItems.length - 1];

    return {
      items: pageItems.map((entry) => mapArticleFeedItem(entry)),
      nextCursor:
        documents.length > limit && lastItem !== undefined
          ? encodeCursor({ value: new Date(lastItem.feedDate).toISOString(), id: lastItem.id })
          : null,
      prevCursor: null,
    };
  }

  async searchPublishedPublicArticles(
    input: SearchPublicArticlesInput,
  ): Promise<ArticleCursorPage<ArticleFeedItem>> {
    const limit = clampPageSize(input.limit);
    const cursor = decodeArticleSearchCursor(input.cursor);
    const normalizedQuery = escapeRegExp(input.query.trim());
    const pipeline: PipelineStage[] = [
      { $match: createPublicArticleMatch() },
      { $project: createSearchScoreProjection(normalizedQuery) },
      { $match: { relevanceScore: { $gt: 0 } } },
    ];

    if (cursor !== null) {
      const cursorDate = new Date(cursor.publishedAt);

      if (!Number.isNaN(cursorDate.getTime())) {
        pipeline.push({
          $match: {
            $or: [
              { relevanceScore: { $lt: cursor.score } },
              { relevanceScore: cursor.score, feedDate: { $lt: cursorDate } },
              { relevanceScore: cursor.score, feedDate: cursorDate, id: { $lt: cursor.id } },
            ],
          },
        });
      }
    }

    pipeline.push(
      { $sort: { relevanceScore: -1, feedDate: -1, id: -1 } },
      { $limit: limit + 1 },
    );

    const documents = await ArticleModel.aggregate<FeedAggregateDocument>(pipeline).exec();
    const pageItems = documents.slice(0, limit);
    const lastItem = pageItems[pageItems.length - 1];

    return {
      items: pageItems.map((entry) => mapArticleFeedItem(entry)),
      nextCursor:
        documents.length > limit && lastItem !== undefined
          ? encodeArticleSearchCursor({
              score: lastItem.relevanceScore ?? 0,
              publishedAt: new Date(lastItem.feedDate).toISOString(),
              id: lastItem.id,
            })
          : null,
      prevCursor: null,
    };
  }

  async listPublicHashtags(input: ListPublicHashtagsInput): Promise<ArticleHashtag[]> {
    const limit = clampPageSize(input.limit, 10, 20);
    const query = input.query?.trim() ?? "";
    const pipeline: PipelineStage[] = [
      { $match: createPublicArticleMatch() },
      { $unwind: "$hashtags" },
    ];

    if (query.length > 0) {
      pipeline.push({
        $match: {
          "hashtags.name": {
            $regex: escapeRegExp(query),
            $options: "i",
          },
        },
      });
    }

    pipeline.push(
      {
        $group: {
          _id: "$hashtags.id",
          id: { $first: "$hashtags.id" },
          name: { $first: "$hashtags.name" },
          articleCount: { $sum: 1 },
        },
      },
      { $sort: { articleCount: -1, name: 1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          id: 1,
          name: 1,
          articleCount: 1,
        },
      },
    );

    const documents = await ArticleModel.aggregate<HashtagAggregateDocument>(pipeline).exec();

    return documents.map((entry) => ({
      id: entry.id,
      name: entry.name,
    }));
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
