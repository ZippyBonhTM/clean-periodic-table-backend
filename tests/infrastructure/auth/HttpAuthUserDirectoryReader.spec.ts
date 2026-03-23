import { afterEach, describe, expect, it, vi } from "vitest";

import HttpAuthUserDirectoryReader from "@/infrastructure/auth/HttpAuthUserDirectoryReader.js";

describe("HttpAuthUserDirectoryReader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports availability only when both path and service token are configured", () => {
    const unavailableReader = new HttpAuthUserDirectoryReader({
      serviceUrl: "https://auth.example.com",
      pathTemplate: null,
      serviceToken: "secret",
    });
    const availableReader = new HttpAuthUserDirectoryReader({
      serviceUrl: "https://auth.example.com",
      pathTemplate: "/internal/users",
      serviceToken: "secret",
    });

    expect(unavailableReader.isAvailable()).toBe(false);
    expect(availableReader.isAvailable()).toBe(true);
  });

  it("lists auth users through the configured internal endpoint", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "user-1",
            name: "Ada Lovelace",
            email: "ADA@example.com",
          },
        ],
        nextCursor: "cursor-2",
      }),
    }));

    vi.stubGlobal("fetch", fetchSpy);

    const reader = new HttpAuthUserDirectoryReader({
      serviceUrl: "https://auth.example.com",
      pathTemplate: "/internal/users",
      serviceToken: "secret",
    });
    const result = await reader.list({
      cursor: "cursor-1",
      limit: 25,
    });

    expect(result).toEqual({
      items: [
        {
          id: "user-1",
          name: "Ada Lovelace",
          email: "ada@example.com",
        },
      ],
      nextCursor: "cursor-2",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://auth.example.com/internal/users?cursor=cursor-1&limit=25"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer secret",
        }),
      }),
    );
  });
});
