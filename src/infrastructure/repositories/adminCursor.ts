export type CursorPayload = {
  value: string;
  id: string;
};

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(value: string | null | undefined): CursorPayload | null {
  const trimmed = value?.trim() ?? "";

  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(trimmed, "base64url").toString("utf8")) as {
      value?: unknown;
      id?: unknown;
    };

    if (typeof parsed.value !== "string" || typeof parsed.id !== "string") {
      return null;
    }

    if (parsed.value.trim().length === 0 || parsed.id.trim().length === 0) {
      return null;
    }

    return {
      value: parsed.value,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function clampPageSize(input: number | undefined, fallback = 20, max = 50): number {
  if (input === undefined || !Number.isFinite(input)) {
    return fallback;
  }

  const normalized = Math.trunc(input);

  if (normalized < 1) {
    return 1;
  }

  if (normalized > max) {
    return max;
  }

  return normalized;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { clampPageSize, decodeCursor, encodeCursor, escapeRegExp };
