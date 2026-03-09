import type {
  MoleculeAtom,
  MoleculeEditorState,
  MoleculeModel,
  SaveUserMoleculeInput,
  UserMoleculeRecord,
} from "@/domain/UserMolecule.js";
import { buildMoleculeSummary } from "@/domain/UserMolecule.js";
import { makeElementProps } from "./elementFixture.js";

function makeAtom(overrides: Partial<MoleculeAtom> = {}): MoleculeAtom {
  const element = makeElementProps();
  const baseAtom: MoleculeAtom = {
    id: "atom-1",
    x: 0,
    y: 0,
    element: {
      number: element.number,
      symbol: element.symbol,
      name: element.name,
      category: element.category,
      group: element.group,
      shells: [...element.shells],
    },
  };

  return {
    ...baseAtom,
    ...overrides,
    element: {
      ...baseAtom.element,
      ...overrides.element,
      shells: overrides.element?.shells ?? baseAtom.element.shells,
    },
  };
}

function makeMoleculeModel(overrides: Partial<MoleculeModel> = {}): MoleculeModel {
  const atoms = overrides.atoms ?? [makeAtom()];

  return {
    atoms,
    bonds: overrides.bonds ?? [],
  };
}

function makeEditorState(overrides: Partial<MoleculeEditorState> = {}): MoleculeEditorState {
  return {
    selectedAtomId: overrides.selectedAtomId ?? null,
    activeView: overrides.activeView ?? "editor",
    bondOrder: overrides.bondOrder ?? 1,
    canvasViewport: {
      offsetX: overrides.canvasViewport?.offsetX ?? 0,
      offsetY: overrides.canvasViewport?.offsetY ?? 0,
      scale: overrides.canvasViewport?.scale ?? 1,
    },
  };
}

function makeSaveUserMoleculeInput(
  overrides: Partial<SaveUserMoleculeInput> = {},
): SaveUserMoleculeInput {
  return {
    userId: overrides.userId ?? "user-1",
    name: overrides.name ?? "Benzeno",
    educationalDescription:
      overrides.educationalDescription ?? "Anel aromático clássico usado em química orgânica.",
    molecule: overrides.molecule ?? makeMoleculeModel(),
    editorState: overrides.editorState ?? makeEditorState(),
  };
}

function makeUserMoleculeRecord(
  overrides: Partial<UserMoleculeRecord> = {},
): UserMoleculeRecord {
  const baseInput = makeSaveUserMoleculeInput(overrides);

  return {
    id: overrides.id ?? "molecule-1",
    ...baseInput,
    summary: overrides.summary ?? buildMoleculeSummary(baseInput.molecule),
    createdAt: overrides.createdAt ?? new Date("2026-03-08T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-03-08T00:00:00.000Z"),
  };
}

export { makeAtom, makeEditorState, makeMoleculeModel, makeSaveUserMoleculeInput, makeUserMoleculeRecord };
