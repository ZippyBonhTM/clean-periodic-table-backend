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
});
