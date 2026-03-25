import mongoose from "mongoose";

import type {
  ArticleAuthor,
  ArticleHashtag,
  ArticleStatus,
  ArticleVisibility,
} from "../../../domain/Article.js";

type ArticleDocument = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  markdownSource: string;
  visibility: ArticleVisibility;
  status: ArticleStatus;
  coverImage: string | null;
  hashtags: ArticleHashtag[];
  author: ArticleAuthor;
  saveCount: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
};

const articleHashtagSchema = new mongoose.Schema<ArticleHashtag>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
  },
  { _id: false, strict: true },
);

const articleAuthorSchema = new mongoose.Schema<ArticleAuthor>(
  {
    id: { type: String, required: true },
    displayName: { type: String, default: null },
    username: { type: String, default: null },
    profileImage: { type: String, default: null },
  },
  { _id: false, strict: true },
);

const articleSchema = new mongoose.Schema<ArticleDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: "" },
    slug: { type: String, required: true, unique: true, index: true },
    excerpt: { type: String, required: true, default: "" },
    markdownSource: { type: String, default: "" },
    visibility: { type: String, required: true, enum: ["public", "private"], index: true },
    status: { type: String, required: true, enum: ["draft", "published", "archived"], index: true },
    coverImage: { type: String, default: null },
    hashtags: { type: [articleHashtagSchema], default: [] },
    author: { type: articleAuthorSchema, required: true },
    saveCount: { type: Number, required: true, default: 0 },
    publishedAt: { type: Date, default: null, index: true },
  },
  {
    strict: true,
    collection: "articles",
    timestamps: true,
  },
);

articleSchema.index({ visibility: 1, status: 1, publishedAt: -1, id: -1 });

const ArticleModel = mongoose.model<ArticleDocument>("Article", articleSchema);

export default ArticleModel;
export type { ArticleDocument };
