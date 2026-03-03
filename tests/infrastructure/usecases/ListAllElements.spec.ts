import { describe, expect, it, vi } from "vitest";

import type ElementRepository from "@/application/protocols/ElementRepository.js";
import ListAllElements from "@/application/usecases/ListAllElements.js";
import Element from "@/domain/Element.js";
import InMemoryElementRepository from "@/infrastructure/repositories/InMemoryElementRepository.js";
import { getFixtureElements, makeElement } from "../../support/elementFixture.js";

describe("InMemoryElementRepository", () => {
  it("returns all elements from fixture", async () => {
    const sut = new InMemoryElementRepository();
    const periodicTableFixture = getFixtureElements();

    const output = await sut.getAllElements();

    expect(periodicTableFixture.length).toBeGreaterThan(0);
    expect(output).toHaveLength(periodicTableFixture.length);
  });

  it("maps fixture items to domain Element preserving symbol order", async () => {
    const sut = new InMemoryElementRepository();
    const periodicTableFixture = getFixtureElements();

    const output = await sut.getAllElements();
    const expectedSymbols = periodicTableFixture.map((element) => element.symbol);

    expect(output.every((element) => element instanceof Element)).toBe(true);
    expect(output.map((element) => element.symbol)).toEqual(expectedSymbols);
  });

  it("returns a new collection with new Element instances on each call", async () => {
    const sut = new InMemoryElementRepository();

    const firstOutput = await sut.getAllElements();
    const secondOutput = await sut.getAllElements();

    expect(firstOutput).not.toBe(secondOutput);
    expect(firstOutput[0]).toBeInstanceOf(Element);
    expect(secondOutput[0]).toBeInstanceOf(Element);
    expect(firstOutput[0]).not.toBe(secondOutput[0]);
    expect(firstOutput.map((element) => element.symbol)).toEqual(
      secondOutput.map((element) => element.symbol),
    );
  });
});

describe("ListAllElements", () => {
  it("delegates to ElementRepository and returns repository output", async () => {
    const repositoryOutput = [makeElement({ symbol: "H", name: "Hydrogen" }), makeElement({ symbol: "He", name: "Helium" })];
    const getAllElements = vi.fn().mockResolvedValue(repositoryOutput);
    const repository: ElementRepository = { getAllElements };
    const sut = new ListAllElements(repository);

    const output = await sut.list();

    expect(getAllElements).toHaveBeenCalledTimes(1);
    expect(output).toBe(repositoryOutput);
  });

  it("returns an empty list when repository has no elements", async () => {
    const repository: ElementRepository = {
      getAllElements: vi.fn().mockResolvedValue([]),
    };
    const sut = new ListAllElements(repository);

    const output = await sut.list();

    expect(output).toEqual([]);
  });

  it("calls repository once per use case invocation", async () => {
    const getAllElements = vi.fn().mockResolvedValue([makeElement({ symbol: "H" })]);
    const repository: ElementRepository = { getAllElements };
    const sut = new ListAllElements(repository);

    await sut.list();
    await sut.list();

    expect(getAllElements).toHaveBeenCalledTimes(2);
  });

  it("propagates repository failure", async () => {
    const repositoryError = new Error("repository unavailable");
    const repository: ElementRepository = {
      getAllElements: vi.fn().mockRejectedValue(repositoryError),
    };
    const sut = new ListAllElements(repository);

    await expect(sut.list()).rejects.toBe(repositoryError);
  });
});
