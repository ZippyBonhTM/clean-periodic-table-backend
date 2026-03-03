import { describe, expect, it, vi } from "vitest";

import type ElementRepository from "@/application/protocols/ElementRepository.js";
import ListAllElements from "@/application/usecases/ListAllElements.js";
import Element from "@/domain/Element.js";
import InMemoryElementRepository from "@/infrastructure/repositories/InMemoryElementRepository.js";

describe("Requirements: ListAllChemicalElements", () => {
  it("FR1 - lists chemical elements", async () => {
    const sut = new ListAllElements(new InMemoryElementRepository());

    const output = await sut.list();

    expect(Array.isArray(output)).toBe(true);
    expect(output.length).toBeGreaterThan(0);
  });

  it("FR2 - propagates repository fetch errors", async () => {
    const repositoryError = new Error("repository fetch failed");
    const repository: ElementRepository = {
      getAllElements: vi.fn().mockRejectedValue(repositoryError),
    };
    const sut = new ListAllElements(repository);

    await expect(sut.list()).rejects.toBe(repositoryError);
  });

  it("NFR1 - stays independent from concrete repository implementation", async () => {
    const repositoryOutput = [new Element("H")];
    const repository: ElementRepository = {
      getAllElements: vi.fn().mockResolvedValue(repositoryOutput),
    };
    const sut = new ListAllElements(repository);

    const output = await sut.list();

    expect(repository.getAllElements).toHaveBeenCalledTimes(1);
    expect(output).toBe(repositoryOutput);
  });

  it("NFR2 - always returns a list of Element", async () => {
    const repository: ElementRepository = {
      getAllElements: vi.fn().mockResolvedValue([new Element("H"), new Element("He")]),
    };
    const sut = new ListAllElements(repository);

    const output = await sut.list();

    expect(output.every((element) => element instanceof Element)).toBe(true);
  });
});
