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

    if (response.status === 401 || response.status === 403) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Auth service returned status ${String(response.status)}.`);
    }

    const payload = (await response.json().catch(() => null)) as ValidateTokenResponse | null;
    const userId = payload?.userId;

    if (typeof userId !== "string" || userId.trim().length === 0) {
      throw new Error("Auth service did not provide a valid userId.");
    }

    return { userId };
  }
}
