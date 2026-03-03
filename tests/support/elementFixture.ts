import { readFileSync } from "node:fs";

import Element, { type ElementProps } from "@/domain/Element.js";

type RawPeriodicElement = Omit<ElementProps, "cpk_hex"> & { "cpk-hex": string | null };

type PeriodicTableFixture = {
  elements: RawPeriodicElement[];
};

function toElementProps(raw: RawPeriodicElement): ElementProps {
  const { "cpk-hex": cpkHex, ...rest } = raw;

  return {
    ...rest,
    cpk_hex: cpkHex,
  };
}

const fixture = JSON.parse(
  readFileSync(new URL("../../src/infrastructure/repositories/PeriodicTable.json", import.meta.url), "utf8"),
) as PeriodicTableFixture;

const normalizedFixture = fixture.elements.map(toElementProps);

function cloneElementProps(element: ElementProps): ElementProps {
  return {
    ...element,
    shells: [...element.shells],
    ionization_energies: [...element.ionization_energies],
    image: {
      ...element.image,
    },
  };
}

function getFixtureElements(): ElementProps[] {
  return normalizedFixture.map(cloneElementProps);
}

type ElementOverrides = Partial<ElementProps> & {
  image?: Partial<ElementProps["image"]>;
};

function makeElementProps(overrides: ElementOverrides = {}): ElementProps {
  const baseElement = normalizedFixture[0];

  if (baseElement === undefined) {
    throw new Error("Periodic table fixture is empty.");
  }

  return {
    ...cloneElementProps(baseElement),
    ...overrides,
    image: {
      ...baseElement.image,
      ...overrides.image,
    },
  };
}

function makeElement(overrides: ElementOverrides = {}): Element {
  return new Element(makeElementProps(overrides));
}

export { getFixtureElements, makeElement, makeElementProps, toElementProps };
export type { ElementOverrides, PeriodicTableFixture, RawPeriodicElement };
