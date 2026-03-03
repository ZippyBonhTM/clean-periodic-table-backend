import { readFileSync } from "node:fs";

import type ElementRepository from "@/application/protocols/ElementRepository.js";
import Element from "@/domain/Element.js";

type PeriodicTableFixture = {
  elements: Array<{ symbol: string }>;
};

export default class InMemoryElementRepository implements ElementRepository {
  async getAllElements(): Promise<Element[]> {
    const fixture = JSON.parse(
      readFileSync(new URL("./PeriodicTable.json", import.meta.url), "utf8"),
    ) as PeriodicTableFixture;

    return fixture.elements.map((element) => new Element(element.symbol));
  }
}
