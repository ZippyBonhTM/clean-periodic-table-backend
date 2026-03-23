import { afterEach, describe, expect, it, vi } from "vitest";

import HttpUserSessionRevoker from "@/infrastructure/auth/HttpUserSessionRevoker.js";

describe("HttpUserSessionRevoker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requires both revoke path and internal service token to be available", () => {
    expect(
      new HttpUserSessionRevoker({
        serviceUrl: "https://auth.example.com",
        pathTemplate: "/internal/users/:userId/sessions/revoke",
        serviceToken: "shared-secret",
      }).isAvailable(),
    ).toBe(true);

    expect(
      new HttpUserSessionRevoker({
        serviceUrl: "https://auth.example.com",
        pathTemplate: "/internal/users/:userId/sessions/revoke",
        serviceToken: null,
      }).isAvailable(),
    ).toBe(false);
  });

  it("calls clean-auth with the internal service token instead of the user bearer token", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        revokedSessionCount: 1,
      }),
    }));

    vi.stubGlobal("fetch", fetchSpy);

    const revoker = new HttpUserSessionRevoker({
      serviceUrl: "https://auth.example.com",
      pathTemplate: "/internal/users/:userId/sessions/revoke",
      serviceToken: "shared-secret",
    });

    await expect(
      revoker.revoke({
        actorUserId: "admin-1",
        targetUserId: "user-1",
        reason: "Security rotation",
        mode: "all",
        accessToken: "user-bearer-token",
      }),
    ).resolves.toBe(1);

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://auth.example.com/internal/users/user-1/sessions/revoke"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer shared-secret",
        }),
      }),
    );
  });
});
