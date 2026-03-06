import type AuthTokenValidator from "../../application/protocols/AuthTokenValidator.js";

export default class AuthServiceTokenValidator implements AuthTokenValidator {
  constructor(
    private readonly serviceUrl: string,
    private readonly validatePath: string,
  ) {}

  async validate(accessToken: string): Promise<boolean> {
    const response = await fetch(new URL(this.validatePath, this.serviceUrl), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      return true;
    }

    if (response.status === 401 || response.status === 403) {
      return false;
    }

    throw new Error(`Unexpected auth service response: ${String(response.status)}`);
  }
}
