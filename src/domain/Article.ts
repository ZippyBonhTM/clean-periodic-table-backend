export type ArticleVisibility = "public" | "private";

export type ArticleStatus = "draft" | "published" | "archived";

export type ArticleAuthor = {
  id: string;
  displayName: string | null;
  username: string | null;
  profileImage: string | null;
};

export type ArticleHashtag = {
  id: string;
  name: string;
};

export type ArticleSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  visibility: ArticleVisibility;
  status: ArticleStatus;
  coverImage: string | null;
  hashtags: ArticleHashtag[];
  author: ArticleAuthor;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
};

export type ArticleRecord = ArticleSummary & {
  markdownSource: string;
  saveCount: number;
};

export type ArticleCursorPage<TItem> = {
  items: TItem[];
  nextCursor: string | null;
  prevCursor: string | null;
};
