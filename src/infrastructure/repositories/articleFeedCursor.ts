import { clampPageSize } from "./adminCursor.js";

type ArticleSearchCursorPayload = {
  score: number;
  publishedAt: string;
  id: string;
};

function encodeArticleSearchCursor(payload: ArticleSearchCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeArticleSearchCursor(value: string | null | undefined): ArticleSearchCursorPayload | null {
  const trimmed = value?.trim() ?? "";

  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(trimmed, "base64url").toString("utf8")) as {
      score?: unknown;
      publishedAt?: unknown;
      id?: unknown;
    };

    if (
      typeof parsed.score !== "number" ||
      Number.isNaN(parsed.score) ||
      typeof parsed.publishedAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      return null;
    }

    if (parsed.publishedAt.trim().length === 0 || parsed.id.trim().length === 0) {
      return null;
    }

    return {
      score: parsed.score,
      publishedAt: parsed.publishedAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

export { clampPageSize, decodeArticleSearchCursor, encodeArticleSearchCursor };
export type { ArticleSearchCursorPayload };
