import type UserSessionRevoker from "../../application/protocols/UserSessionRevoker.js";
import type { RevokeUserSessionsInput } from "../../application/protocols/UserSessionRevoker.js";

type SessionRevokerInput = {
  serviceUrl: string;
  pathTemplate: string | null;
};

function buildRevokeUrl(serviceUrl: string, pathTemplate: string, userId: string): URL {
  const normalizedPath = pathTemplate.replace(":userId", encodeURIComponent(userId)).replace("{userId}", encodeURIComponent(userId));
  return new URL(normalizedPath, serviceUrl);
}

export default class HttpUserSessionRevoker implements UserSessionRevoker {
  constructor(private readonly input: SessionRevokerInput) {}

  isAvailable(): boolean {
    return this.input.pathTemplate !== null && this.input.pathTemplate.trim().length > 0;
  }

  async revoke(input: RevokeUserSessionsInput): Promise<number> {
    const pathTemplate = this.input.pathTemplate?.trim() ?? "";

    if (pathTemplate.length === 0) {
      throw new Error("Session revoke endpoint is not configured.");
    }

    const response = await fetch(buildRevokeUrl(this.input.serviceUrl, pathTemplate, input.targetUserId), {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        actorUserId: input.actorUserId,
        reason: input.reason,
        mode: input.mode,
      }),
    });

    if (!response.ok) {
      throw new Error(`Unexpected auth session revoke response: ${String(response.status)}`);
    }

    const payload = (await response.json().catch(() => null)) as { revokedSessionCount?: unknown } | null;
    const revokedSessionCount = payload?.revokedSessionCount;

    return typeof revokedSessionCount === "number" && Number.isFinite(revokedSessionCount)
      ? revokedSessionCount
      : 0;
  }
}
