import { readFileSync } from "node:fs";

import type { ElementProps } from "../../domain/Element.js";

type RawPeriodicElement = Omit<ElementProps, "cpk_hex"> & { "cpk-hex": string | null };

type PeriodicTableFixture = {
  elements: RawPeriodicElement[];
};

function normalizeFixtureElement(rawElement: RawPeriodicElement): ElementProps {
  const { "cpk-hex": cpkHex, ...rest } = rawElement;

  return {
    ...rest,
    cpk_hex: cpkHex,
  };
}

function loadPeriodicTableFixture(): ElementProps[] {
  const fixture = JSON.parse(
    readFileSync(new URL("./PeriodicTable.json", import.meta.url), "utf8"),
  ) as PeriodicTableFixture;

  return fixture.elements.map(normalizeFixtureElement);
}

export { loadPeriodicTableFixture, normalizeFixtureElement };
export type { PeriodicTableFixture, RawPeriodicElement };
