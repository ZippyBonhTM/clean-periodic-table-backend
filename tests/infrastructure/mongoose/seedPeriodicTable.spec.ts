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

vi.mock("@/infrastructure/mongoose/models/PeriodicTableModel.js", () => ({
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

  it("throws when mongo uri is missing", async () => {
    await expect(seedPeriodicTable({ mongoUri: null })).rejects.toThrow(
      "Missing Mongo URI. Set MONGODB_URI (or fallback equivalent) before seeding.",
    );
  });

  it("connects, upserts fixture and disconnects when uri is provided", async () => {
    await seedPeriodicTable({ mongoUri: "mongodb://cluster.local/periodic-table" });

    expect(connectMongoMock).toHaveBeenCalledWith("mongodb://cluster.local/periodic-table");
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock).toHaveBeenCalledWith(
      {},
      {
        $set: {
          elements: expect.any(Array),
        },
      },
      { upsert: true },
    );
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

    const output = await runSeedScript({ mongoUri: "mongodb://cluster.local/periodic-table" });

    expect(output).toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith("Periodic table seed completed.\n");
  });

  it("returns 1 and attempts disconnect on failure", async () => {
    connectMongoMock.mockRejectedValue(new Error("connection failed"));
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const output = await runSeedScript({ mongoUri: "mongodb://cluster.local/periodic-table" });

    expect(output).toBe(1);
    expect(disconnectMongoMock).toHaveBeenCalledTimes(1);
    expect(stderrWrite).toHaveBeenCalledWith("Seed failed: Error: connection failed\n");
  });
});
