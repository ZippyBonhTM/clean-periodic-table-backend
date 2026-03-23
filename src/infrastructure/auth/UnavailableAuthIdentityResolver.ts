import type AuthIdentityResolver from "../../application/protocols/AuthIdentityResolver.js";

export default class UnavailableAuthIdentityResolver implements AuthIdentityResolver {
  async resolve(): Promise<null> {
    return null;
  }
}
