import { describe, expect, it, vi } from "vitest";

import type AuthIdentityResolver from "@/application/protocols/AuthIdentityResolver.js";
import { createSyncAuthenticatedProductUserMiddleware } from "@/http/middlewares/syncAuthenticatedProductUser.js";
import InMemoryProductUserRepository from "@/infrastructure/repositories/InMemoryProductUserRepository.js";

describe("createSyncAuthenticatedProductUserMiddleware", () => {
  it("syncs the current authenticated identity into the product user repository", async () => {
    const productUserRepository = new InMemoryProductUserRepository();
    const authIdentityResolver: AuthIdentityResolver = {
      async resolve() {
        return {
          id: "user-1",
          name: "User One",
          email: "user@example.com",
        };
      },
    };

    const middleware = createSyncAuthenticatedProductUserMiddleware({
      authIdentityResolver,
      productUserRepository,
      bootstrapAdminUserIds: new Set(["user-1"]),
    });
    const next = vi.fn();

    await middleware(
      {
        auth: {
          userId: "user-1",
          accessToken: "token-1",
        },
      } as never,
      {} as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);

    const storedUser = await productUserRepository.findById("user-1");

    expect(storedUser).toMatchObject({
      id: "user-1",
      email: "user@example.com",
      role: "ADMIN",
    });
    expect(storedUser?.lastSeenAt).toBeInstanceOf(Date);
  });

  it("does not block the request when profile resolution fails", async () => {
    const productUserRepository = new InMemoryProductUserRepository();
    const authIdentityResolver: AuthIdentityResolver = {
      async resolve() {
        throw new Error("auth unavailable");
      },
    };

    const middleware = createSyncAuthenticatedProductUserMiddleware({
      authIdentityResolver,
      productUserRepository,
      bootstrapAdminUserIds: new Set(),
    });
    const next = vi.fn();

    await middleware(
      {
        auth: {
          userId: "user-1",
          accessToken: "token-1",
        },
      } as never,
      {} as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    await expect(productUserRepository.findById("user-1")).resolves.toBeNull();
  });
});
