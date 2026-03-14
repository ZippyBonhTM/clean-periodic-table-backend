import type { RequestHandler } from "express";

import type AuthTokenValidator from "../../application/protocols/AuthTokenValidator.js";

function getBearerToken(authorizationHeader: string | undefined): string | null {
  if (authorizationHeader === undefined) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || token === undefined || token.trim().length === 0) {
    return null;
  }

  return token;
}

function createRequireAuthMiddleware(validator: AuthTokenValidator): RequestHandler {
  return async (request, response, next) => {
    const token = getBearerToken(request.headers.authorization);

    if (token === null) {
      response.status(401).json({ message: "Unauthorized." });
      return;
    }

    try {
      const authenticatedUser = await validator.validate(token);

      if (authenticatedUser === null) {
        response.status(401).json({ message: "Unauthorized." });
        return;
      }

      request.auth = {
        userId: authenticatedUser.userId,
        accessToken: token,
      };
      next();
    } catch {
      response.status(503).json({ message: "Authentication service unavailable." });
    }
  };
}

export { createRequireAuthMiddleware, getBearerToken };
