import type { ProductUserIdentity } from "../../domain/Admin.js";

export default interface AuthIdentityResolver {
  resolve(accessToken: string): Promise<ProductUserIdentity | null>;
}
