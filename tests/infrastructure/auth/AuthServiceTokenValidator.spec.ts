import { afterEach, describe, expect, it, vi } from "vitest";

import AuthServiceTokenValidator from "@/infrastructure/auth/AuthServiceTokenValidator.js";

describe("AuthServiceTokenValidator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when the auth service validates the token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    const sut = new AuthServiceTokenValidator("http://auth.local", "/validate-token");

    await expect(sut.validate("valid-token")).resolves.toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      new URL("/validate-token", "http://auth.local"),
      expect.objectContaining({
        method: "GET",
        headers: {
          authorization: "Bearer valid-token",
        },
      }),
    );
  });

  it("returns false when the auth service rejects the token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 401,
      }),
    );

    const sut = new AuthServiceTokenValidator("http://auth.local", "/validate-token");

    await expect(sut.validate("invalid-token")).resolves.toBe(false);
  });

  it("throws when the auth service responds with an unexpected status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 500,
      }),
    );

    const sut = new AuthServiceTokenValidator("http://auth.local", "/validate-token");

    await expect(sut.validate("any-token")).rejects.toThrow(
      "Unexpected auth service response: 500",
    );
  });
});
