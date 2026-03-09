export type BondOrder = 1 | 2 | 3;

export type MoleculeEditorViewMode = "editor" | "structural" | "simplified" | "stick";

export type MoleculeElementSnapshot = {
  number: number;
  symbol: string;
  name: string;
  category: string;
  group: number;
  shells: number[];
};

export type MoleculeAtom = {
  id: string;
  element: MoleculeElementSnapshot;
  x: number;
  y: number;
};

export type MoleculeBond = {
  id: string;
  sourceId: string;
  targetId: string;
  order: BondOrder;
};

export type MoleculeModel = {
  atoms: MoleculeAtom[];
  bonds: MoleculeBond[];
};

export type MoleculeCanvasViewport = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

export type MoleculeEditorState = {
  selectedAtomId: string | null;
  activeView: MoleculeEditorViewMode;
  bondOrder: BondOrder;
  canvasViewport: MoleculeCanvasViewport;
};

export type MoleculeCompositionEntry = {
  symbol: string;
  name: string;
  count: number;
};

export type MoleculeSummary = {
  formula: string;
  atomCount: number;
  bondCount: number;
  totalBondOrder: number;
  composition: MoleculeCompositionEntry[];
};

export type SaveUserMoleculeInput = {
  userId: string;
  name: string | null;
  educationalDescription: string | null;
  molecule: MoleculeModel;
  editorState: MoleculeEditorState;
};

export type UpdateUserMoleculeInput = Omit<SaveUserMoleculeInput, "userId">;

export type UserMoleculeRecord = SaveUserMoleculeInput & {
  id: string;
  summary: MoleculeSummary;
  createdAt: Date;
  updatedAt: Date;
};

function buildFormula(model: MoleculeModel): string {
  if (model.atoms.length === 0) {
    return "Empty molecule";
  }

  const counts = new Map<string, number>();

  model.atoms.forEach((atom) => {
    counts.set(atom.element.symbol, (counts.get(atom.element.symbol) ?? 0) + 1);
  });

  const symbols = [...counts.keys()];
  const hasCarbon = counts.has("C");

  symbols.sort((first, second) => {
    if (hasCarbon) {
      if (first === "C") {
        return -1;
      }

      if (second === "C") {
        return 1;
      }

      if (first === "H") {
        return second === "C" ? 1 : -1;
      }

      if (second === "H") {
        return first === "C" ? -1 : 1;
      }
    }

    return first.localeCompare(second);
  });

  return symbols
    .map((symbol) => {
      const count = counts.get(symbol) ?? 0;
      return `${symbol}${count > 1 ? count : ""}`;
    })
    .join("");
}

function buildComposition(model: MoleculeModel): MoleculeCompositionEntry[] {
  const counts = new Map<string, MoleculeCompositionEntry>();

  model.atoms.forEach((atom) => {
    const current = counts.get(atom.element.symbol);

    if (current === undefined) {
      counts.set(atom.element.symbol, {
        symbol: atom.element.symbol,
        name: atom.element.name,
        count: 1,
      });
      return;
    }

    counts.set(atom.element.symbol, {
      ...current,
      count: current.count + 1,
    });
  });

  return [...counts.values()].sort((first, second) => first.symbol.localeCompare(second.symbol));
}

function buildMoleculeSummary(model: MoleculeModel): MoleculeSummary {
  return {
    formula: buildFormula(model),
    atomCount: model.atoms.length,
    bondCount: model.bonds.length,
    totalBondOrder: model.bonds.reduce((sum, bond) => sum + bond.order, 0),
    composition: buildComposition(model),
  };
}

export { buildMoleculeSummary };
