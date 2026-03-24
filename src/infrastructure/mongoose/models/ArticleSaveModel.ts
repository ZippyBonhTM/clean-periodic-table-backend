import mongoose from "mongoose";

type ArticleSaveDocument = {
  userId: string;
  articleId: string;
  createdAt: Date;
};

const articleSaveSchema = new mongoose.Schema<ArticleSaveDocument>(
  {
    userId: { type: String, required: true, index: true },
    articleId: { type: String, required: true, index: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  {
    strict: true,
    collection: "article_saves",
    timestamps: false,
  },
);

articleSaveSchema.index({ userId: 1, articleId: 1 }, { unique: true });
articleSaveSchema.index({ userId: 1, createdAt: -1, articleId: -1 });

const ArticleSaveModel = mongoose.model<ArticleSaveDocument>("ArticleSave", articleSaveSchema);

export default ArticleSaveModel;
export type { ArticleSaveDocument };
