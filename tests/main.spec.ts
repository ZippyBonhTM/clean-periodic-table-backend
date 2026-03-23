import { describe, expect, it, vi } from "vitest";

import type { AppEnv } from "@/config/env.js";
import { buildAuthMiddleware, createShutdownHandler } from "@/main.js";

const baseEnv: AppEnv = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3333,
  mongoUri: null,
  dataSource: "memory",
  authRequired: false,
  authServiceUrl: null,
  authInternalServiceToken: null,
  authValidatePath: "/validate-token",
  authProfilePath: "/profile",
  authRevokeUserSessionsPath: null,
  adminBootstrapUserIds: [],
};

describe("buildAuthMiddleware", () => {
  it("returns undefined when auth is not required", () => {
    const output = buildAuthMiddleware(baseEnv);

    expect(output).toBeUndefined();
  });

  it("throws when auth is required but service url is missing", () => {
    expect(() =>
      buildAuthMiddleware({
        ...baseEnv,
        authRequired: true,
      }),
    ).toThrow("AUTH_SERVICE_URL is required when AUTH_REQUIRED=true.");
  });

  it("returns middleware when auth is required and service url exists", () => {
    const output = buildAuthMiddleware({
      ...baseEnv,
      authRequired: true,
      authServiceUrl: "http://auth.internal",
    });

    expect(typeof output).toBe("function");
  });
});

describe("createShutdownHandler", () => {
  it("closes server and disconnects mongo when source is mongo", async () => {
    const close = vi.fn((callback: (error?: Error) => void) => callback());
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const server = { close } as unknown as Parameters<typeof createShutdownHandler>[0];
    const shutdown = createShutdownHandler(server, true, disconnect);

    await shutdown("SIGTERM");

    expect(close).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("propagates close errors", async () => {
    const closeError = new Error("close failed");
    const close = vi.fn((callback: (error?: Error) => void) => callback(closeError));
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const server = { close } as unknown as Parameters<typeof createShutdownHandler>[0];
    const shutdown = createShutdownHandler(server, true, disconnect);

    await expect(shutdown("SIGINT")).rejects.toBe(closeError);
    expect(disconnect).not.toHaveBeenCalled();
  });
});
