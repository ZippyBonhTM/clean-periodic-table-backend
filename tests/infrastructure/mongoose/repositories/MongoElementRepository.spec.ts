import { beforeEach, describe, expect, it, vi } from "vitest";

const { execMock, leanMock, findOneMock } = vi.hoisted(() => {
  const exec = vi.fn();
  const lean = vi.fn(() => ({ exec }));
  const findOne = vi.fn(() => ({ lean }));

  return { execMock: exec, leanMock: lean, findOneMock: findOne };
});

vi.mock("@/infrastructure/mongoose/models/PeriodicTableModel.js", () => ({
  default: {
    findOne: findOneMock,
  },
}));

import MongoElementRepository from "@/infrastructure/mongoose/repositories/MongoElementRepository.js";
import Element from "@/domain/Element.js";

describe("MongoElementRepository", () => {
  beforeEach(() => {
    execMock.mockReset();
    leanMock.mockClear();
    findOneMock.mockClear();
  });

  it("returns empty list when no periodic table document exists", async () => {
    execMock.mockResolvedValue(null);
    const sut = new MongoElementRepository();

    const output = await sut.getAllElements();

    expect(output).toEqual([]);
    expect(findOneMock).toHaveBeenCalledWith({}, { elements: 1, _id: 0 });
    expect(leanMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledTimes(1);
  });

  it("maps stored symbols into domain Element instances", async () => {
    execMock.mockResolvedValue({
      elements: [{ symbol: "H" }, { symbol: "He" }, { symbol: "Li" }],
    });
    const sut = new MongoElementRepository();

    const output = await sut.getAllElements();

    expect(output).toHaveLength(3);
    expect(output.every((element) => element instanceof Element)).toBe(true);
    expect(output.map((element) => element.symbol)).toEqual(["H", "He", "Li"]);
  });
});
