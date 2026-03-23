import type { ProductUserIdentity } from "../../domain/Admin.js";

export type ListAuthUsersInput = {
  cursor?: string | null;
  limit: number;
};

export type ListAuthUsersResult = {
  items: ProductUserIdentity[];
  nextCursor: string | null;
};

export default interface AuthUserDirectoryReader {
  isAvailable(): boolean;
  list(input: ListAuthUsersInput): Promise<ListAuthUsersResult>;
}
