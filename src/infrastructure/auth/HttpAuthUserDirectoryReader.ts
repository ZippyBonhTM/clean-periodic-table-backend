import type AuthUserDirectoryReader from "../../application/protocols/AuthUserDirectoryReader.js";
import type {
  ListAuthUsersInput,
  ListAuthUsersResult,
} from "../../application/protocols/AuthUserDirectoryReader.js";

type AuthUserDirectoryReaderInput = {
  serviceUrl: string;
  pathTemplate: string | null;
  serviceToken: string | null;
};

type AuthDirectoryPayload = {
  items?: Array<{
    id?: unknown;
    name?: unknown;
    email?: unknown;
  }>;
  nextCursor?: unknown;
};

function buildListUsersUrl(serviceUrl: string, pathTemplate: string, input: ListAuthUsersInput): URL {
  const url = new URL(pathTemplate, serviceUrl);

  if (input.cursor !== undefined && input.cursor !== null && input.cursor.trim().length > 0) {
    url.searchParams.set("cursor", input.cursor.trim());
  }

  url.searchParams.set("limit", String(input.limit));
  return url;
}

export default class HttpAuthUserDirectoryReader implements AuthUserDirectoryReader {
  constructor(private readonly input: AuthUserDirectoryReaderInput) {}

  isAvailable(): boolean {
    return (
      this.input.pathTemplate !== null &&
      this.input.pathTemplate.trim().length > 0 &&
      this.input.serviceToken !== null &&
      this.input.serviceToken.trim().length > 0
    );
  }

  async list(input: ListAuthUsersInput): Promise<ListAuthUsersResult> {
    const pathTemplate = this.input.pathTemplate?.trim() ?? "";
    const serviceToken = this.input.serviceToken?.trim() ?? "";

    if (pathTemplate.length === 0 || serviceToken.length === 0) {
      throw new Error("Auth directory endpoint is not configured.");
    }

    const response = await fetch(buildListUsersUrl(this.input.serviceUrl, pathTemplate, input), {
      method: "GET",
      headers: {
        authorization: `Bearer ${serviceToken}`,
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Unexpected auth user directory response: ${String(response.status)}`);
    }

    const payload = (await response.json().catch(() => null)) as AuthDirectoryPayload | null;
    const items = Array.isArray(payload?.items)
      ? payload.items.flatMap((entry) => {
          const id = entry?.id;
          const name = entry?.name;
          const email = entry?.email;

          if (
            typeof id !== "string" || id.trim().length === 0 ||
            typeof name !== "string" || name.trim().length === 0 ||
            typeof email !== "string" || email.trim().length === 0
          ) {
            return [];
          }

          return [{
            id: id.trim(),
            name: name.trim(),
            email: email.trim().toLowerCase(),
          }];
        })
      : [];
    const nextCursor =
      typeof payload?.nextCursor === "string" && payload.nextCursor.trim().length > 0
        ? payload.nextCursor.trim()
        : null;

    return {
      items,
      nextCursor,
    };
  }
}
