import type ElementRepository from "../../application/protocols/ElementRepository.js";
import Element from "../../domain/Element.js";
import { loadPeriodicTableFixture } from "./periodicTableFixture.js";

export default class InMemoryElementRepository implements ElementRepository {
  async getAllElements(): Promise<Element[]> {
    const fixtureElements = loadPeriodicTableFixture();

    return fixtureElements.map((element) => new Element(element));
  }
}
