import { beforeEach, describe, expect, it, vi } from "vitest";

import Element from "@/domain/Element.js";
import type { ElementDocument } from "@/infrastructure/mongoose/models/ElementModel.js";
import MongoElementRepository from "@/infrastructure/mongoose/repositories/MongoElementRepository.js";
import { makeElementProps } from "../../../support/elementFixture.js";

const { execMock, leanMock, sortMock, findMock } = vi.hoisted(() => {
  const exec = vi.fn();
  const lean = vi.fn(() => ({ exec }));
  const sort = vi.fn(() => ({ lean }));
  const find = vi.fn(() => ({ sort }));

  return { execMock: exec, leanMock: lean, sortMock: sort, findMock: find };
});

vi.mock("@/infrastructure/mongoose/models/ElementModel.js", () => ({
  default: {
    find: findMock,
  },
}));

describe("MongoElementRepository", () => {
  beforeEach(() => {
    execMock.mockReset();
    leanMock.mockClear();
    sortMock.mockClear();
    findMock.mockClear();
  });

  it("returns empty list when collection has no document", async () => {
    execMock.mockResolvedValue([]);
    const sut = new MongoElementRepository();

    const output = await sut.getAllElements();

    expect(output).toEqual([]);
    expect(findMock).toHaveBeenCalledWith({}, { _id: 0, __v: 0 });
    expect(sortMock).toHaveBeenCalledWith({ number: 1 });
    expect(leanMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledTimes(1);
  });

  it("maps persisted documents into full domain Element instances", async () => {
    const hydrogen = makeElementProps({ symbol: "H", name: "Hydrogen" });
    const helium = makeElementProps({ symbol: "He", name: "Helium", number: 2 });

    execMock.mockResolvedValue([hydrogen, helium] satisfies ElementDocument[]);
    const sut = new MongoElementRepository();

    const output = await sut.getAllElements();

    expect(output).toHaveLength(2);
    expect(output.every((element) => element instanceof Element)).toBe(true);
    expect(output[0]).toMatchObject({
      symbol: "H",
      name: "Hydrogen",
      cpk_hex: expect.any(String),
    });
    expect(output[1]).toMatchObject({
      symbol: "He",
      name: "Helium",
      number: 2,
    });
  });
});
