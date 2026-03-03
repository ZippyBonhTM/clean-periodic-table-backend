import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { connectMongoMock, disconnectMongoMock, updateOneMock } = vi.hoisted(() => ({
  connectMongoMock: vi.fn(),
  disconnectMongoMock: vi.fn(),
  updateOneMock: vi.fn(),
}));

vi.mock("@/infrastructure/mongoose/connect.js", () => ({
  connectMongo: connectMongoMock,
  disconnectMongo: disconnectMongoMock,
}));

vi.mock("@/infrastructure/mongoose/models/ElementModel.js", () => ({
  default: {
    updateOne: updateOneMock,
  },
}));

import { runSeedScript, seedPeriodicTable } from "@/infrastructure/mongoose/seedPeriodicTable.js";

describe("seedPeriodicTable", () => {
  beforeEach(() => {
    connectMongoMock.mockReset();
    disconnectMongoMock.mockReset();
    updateOneMock.mockReset();

    connectMongoMock.mockResolvedValue(undefined);
    disconnectMongoMock.mockResolvedValue(undefined);
    updateOneMock.mockResolvedValue({ acknowledged: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prompts for MONGO_URI when app env has no uri", async () => {
    const promptMongoUri = vi.fn().mockResolvedValue("mongodb://cluster.local/periodic-table");

    await seedPeriodicTable({ mongoUri: null }, promptMongoUri);

    expect(promptMongoUri).toHaveBeenCalledTimes(1);
    expect(promptMongoUri).toHaveBeenCalledWith("MONGO_URI: ");
    expect(connectMongoMock).toHaveBeenCalledWith("mongodb://cluster.local/periodic-table");
  });

  it("throws when MONGO_URI stays empty after prompt", async () => {
    const promptMongoUri = vi.fn().mockResolvedValue("   ");

    await expect(seedPeriodicTable({ mongoUri: null }, promptMongoUri)).rejects.toThrow(
      "Missing Mongo URI. Set MONGO_URI (or fallback equivalent) before seeding.",
    );
  });

  it("upserts fixture one element at a time", async () => {
    await seedPeriodicTable({ mongoUri: "mongodb://cluster.local/periodic-table" }, vi.fn());

    expect(connectMongoMock).toHaveBeenCalledWith("mongodb://cluster.local/periodic-table");
    expect(updateOneMock).toHaveBeenCalled();
    expect(updateOneMock.mock.calls.length).toBeGreaterThan(100);

    const firstCall = updateOneMock.mock.calls[0];

    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toMatchObject({
      symbol: expect.any(String),
      name: expect.any(String),
    });
    expect(firstCall?.[1]).toMatchObject({
      $set: expect.objectContaining({
        symbol: expect.any(String),
        name: expect.any(String),
        cpk_hex: expect.anything(),
      }),
    });
    expect(firstCall?.[2]).toEqual({ upsert: true });
    expect(disconnectMongoMock).toHaveBeenCalledTimes(1);
  });
});

describe("runSeedScript", () => {
  beforeEach(() => {
    connectMongoMock.mockReset();
    disconnectMongoMock.mockReset();
    updateOneMock.mockReset();

    connectMongoMock.mockResolvedValue(undefined);
    disconnectMongoMock.mockResolvedValue(undefined);
    updateOneMock.mockResolvedValue({ acknowledged: true });
  });

  it("returns 0 and prints success message on success", async () => {
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const output = await runSeedScript({ mongoUri: "mongodb://cluster.local/periodic-table" }, vi.fn());

    expect(output).toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith("Periodic table seed completed.\n");
  });

  it("returns 1 and attempts disconnect on failure", async () => {
    connectMongoMock.mockRejectedValue(new Error("connection failed"));
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const output = await runSeedScript({ mongoUri: "mongodb://cluster.local/periodic-table" }, vi.fn());

    expect(output).toBe(1);
    expect(disconnectMongoMock).toHaveBeenCalledTimes(1);
    expect(stderrWrite).toHaveBeenCalledWith("Seed failed: Error: connection failed\n");
  });
});
