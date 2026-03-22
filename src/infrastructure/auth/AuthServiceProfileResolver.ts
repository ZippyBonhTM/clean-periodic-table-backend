import type AuthIdentityResolver from "../../application/protocols/AuthIdentityResolver.js";
import type { ProductUserIdentity } from "../../domain/Admin.js";

type ProfileResponse = {
  userProfile?: {
    id?: unknown;
    name?: unknown;
    email?: unknown;
  };
};

export default class AuthServiceProfileResolver implements AuthIdentityResolver {
  constructor(
    private readonly serviceUrl: string,
    private readonly profilePath: string,
  ) {}

  async resolve(accessToken: string): Promise<ProductUserIdentity | null> {
    const response = await fetch(new URL(this.profilePath, this.serviceUrl), {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });

    if (response.status === 401 || response.status === 403) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Unexpected auth profile response: ${String(response.status)}`);
    }

    const payload = (await response.json()) as ProfileResponse;
    const id = payload.userProfile?.id;
    const name = payload.userProfile?.name;
    const email = payload.userProfile?.email;

    if (
      typeof id !== "string" || id.trim().length === 0 ||
      typeof name !== "string" || name.trim().length === 0 ||
      typeof email !== "string" || email.trim().length === 0
    ) {
      throw new Error("Unexpected auth profile payload.");
    }

    return {
      id: id.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
    };
  }
}
