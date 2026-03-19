import type {
  AuthenticatedUser,
} from "../../application/protocols/AuthTokenValidator.js";
import type AuthTokenValidator from "../../application/protocols/AuthTokenValidator.js";

type ValidateTokenResponse = {
  userId?: unknown;
};

export default class AuthServiceTokenValidator implements AuthTokenValidator {
  constructor(
    private readonly serviceUrl: string,
    private readonly validatePath: string,
  ) {}

  async validate(accessToken: string): Promise<AuthenticatedUser | null> {
    const response = await fetch(new URL(this.validatePath, this.serviceUrl), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const payload = (await response.json()) as ValidateTokenResponse;

      if (typeof payload.userId !== "string" || payload.userId.trim().length === 0) {
        throw new Error("Unexpected auth service payload: missing userId.");
      }

      return {
        userId: payload.userId,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return null;
    }

    throw new Error(`Unexpected auth service response: ${String(response.status)}`);
  }
}
