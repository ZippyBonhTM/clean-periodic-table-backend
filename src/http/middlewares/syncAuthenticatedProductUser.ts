import type { RequestHandler } from "express";

import type AuthIdentityResolver from "../../application/protocols/AuthIdentityResolver.js";
import type ProductUserRepository from "../../application/protocols/ProductUserRepository.js";

type CreateSyncAuthenticatedProductUserMiddlewareInput = {
  authIdentityResolver: AuthIdentityResolver;
  productUserRepository: ProductUserRepository;
  bootstrapAdminUserIds: Set<string>;
};

function createSyncAuthenticatedProductUserMiddleware({
  authIdentityResolver,
  productUserRepository,
  bootstrapAdminUserIds,
}: CreateSyncAuthenticatedProductUserMiddlewareInput): RequestHandler {
  return async (request, _response, next) => {
    const accessToken = request.auth?.accessToken?.trim() ?? "";

    if (accessToken.length === 0) {
      next();
      return;
    }

    try {
      const identity = await authIdentityResolver.resolve(accessToken);

      if (identity !== null) {
        await productUserRepository.upsertIdentity({
          identity,
          defaultRole: "USER",
          forceAdmin: bootstrapAdminUserIds.has(identity.id),
          accountVersion: "legacy",
          touchLastSeenAt: new Date(),
        });
      }
    } catch {
      // Keep product routes available even if profile sync is temporarily unavailable.
    }

    next();
  };
}

export { createSyncAuthenticatedProductUserMiddleware };
export type { CreateSyncAuthenticatedProductUserMiddlewareInput };
