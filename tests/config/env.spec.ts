import { describe, expect, it } from "vitest";

import { buildEnv } from "@/config/env.js";

describe("buildEnv", () => {
  it("uses safe defaults when values are missing", () => {
    const output = buildEnv({});

    expect(output).toEqual({
      nodeEnv: "development",
      host: "0.0.0.0",
      port: 3000,
      mongoUri: null,
      dataSource: "memory",
      authRequired: false,
      authServiceUrl: null,
      authInternalServiceToken: null,
      authValidatePath: "/validate-token",
      authProfilePath: "/profile",
      authRevokeUserSessionsPath: null,
      adminBootstrapUserIds: [],
    });
  });

  it("throws for invalid NODE_ENV", () => {
    expect(() => buildEnv({ NODE_ENV: "staging" })).toThrow(
      'Invalid NODE_ENV: "staging". Use development | test | production.',
    );
  });

  it("throws for invalid PORT", () => {
    expect(() => buildEnv({ PORT: "0" })).toThrow('Invalid PORT: "0".');
  });

  it("infers mongo data source when mongo uri is provided by fallback variable", () => {
    const output = buildEnv({ MONGODB_URL: "mongodb://cluster.local/periodic-table" });

    expect(output.mongoUri).toBe("mongodb://cluster.local/periodic-table");
    expect(output.dataSource).toBe("mongo");
  });

  it("accepts MONGO_URI as a supported mongo variable", () => {
    const output = buildEnv({ MONGO_URI: "mongodb://cluster.local/periodic-table" });

    expect(output.mongoUri).toBe("mongodb://cluster.local/periodic-table");
    expect(output.dataSource).toBe("mongo");
  });

  it("throws when DATA_SOURCE is mongo without uri", () => {
    expect(() => buildEnv({ DATA_SOURCE: "mongo" })).toThrow(
      "DATA_SOURCE is set to mongo but no Mongo URI was provided. Set MONGODB_URI (or fallback name).",
    );
  });

  it("enforces mongo uri in production when data source is mongo", () => {
    expect(() => buildEnv({ NODE_ENV: "production", DATA_SOURCE: "mongo" })).toThrow(
      "Mongo URI is required in production when DATA_SOURCE=mongo.",
    );
  });

  it("throws for invalid AUTH_REQUIRED value", () => {
    expect(() => buildEnv({ AUTH_REQUIRED: "yes" })).toThrow(
      'Invalid AUTH_REQUIRED: "yes". Use true | false.',
    );
  });

  it("requires AUTH_SERVICE_URL when AUTH_REQUIRED=true", () => {
    expect(() => buildEnv({ AUTH_REQUIRED: "true" })).toThrow(
      "AUTH_SERVICE_URL is required when AUTH_REQUIRED=true.",
    );
  });

  it("reads the optional internal service token for auth-to-backend privileged calls", () => {
    const output = buildEnv({ AUTH_INTERNAL_SERVICE_TOKEN: " shared-secret " });

    expect(output.authInternalServiceToken).toBe("shared-secret");
  });
});
