import mongoose from "mongoose";

import type {
  MoleculeAtom,
  MoleculeBond,
  MoleculeCanvasViewport,
  MoleculeCompositionEntry,
  MoleculeEditorState,
  MoleculeElementSnapshot,
  MoleculeModel,
  MoleculeSummary,
  SaveUserMoleculeInput,
} from "../../../domain/UserMolecule.js";

type UserMoleculeDocument = SaveUserMoleculeInput & {
  summary: MoleculeSummary;
  createdAt: Date;
  updatedAt: Date;
};

const elementSnapshotSchema = new mongoose.Schema<MoleculeElementSnapshot>(
  {
    number: { type: Number, required: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    group: { type: Number, required: true },
    shells: { type: [Number], required: true },
  },
  { _id: false, strict: true },
);

const atomSchema = new mongoose.Schema<MoleculeAtom>(
  {
    id: { type: String, required: true },
    element: { type: elementSnapshotSchema, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false, strict: true },
);

const bondSchema = new mongoose.Schema<MoleculeBond>(
  {
    id: { type: String, required: true },
    sourceId: { type: String, required: true },
    targetId: { type: String, required: true },
    order: { type: Number, required: true, enum: [1, 2, 3] },
  },
  { _id: false, strict: true },
);

const moleculeSchema = new mongoose.Schema<MoleculeModel>(
  {
    atoms: { type: [atomSchema], required: true, default: [] },
    bonds: { type: [bondSchema], required: true, default: [] },
  },
  { _id: false, strict: true },
);

const canvasViewportSchema = new mongoose.Schema<MoleculeCanvasViewport>(
  {
    offsetX: { type: Number, required: true },
    offsetY: { type: Number, required: true },
    scale: { type: Number, required: true },
  },
  { _id: false, strict: true },
);

const editorStateSchema = new mongoose.Schema<MoleculeEditorState>(
  {
    selectedAtomId: { type: String, default: null },
    activeView: {
      type: String,
      required: true,
      enum: ["editor", "structural", "simplified", "stick"],
    },
    bondOrder: { type: Number, required: true, enum: [1, 2, 3] },
    canvasViewport: { type: canvasViewportSchema, required: true },
  },
  { _id: false, strict: true },
);

const compositionEntrySchema = new mongoose.Schema<MoleculeCompositionEntry>(
  {
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    count: { type: Number, required: true },
  },
  { _id: false, strict: true },
);

const summarySchema = new mongoose.Schema<MoleculeSummary>(
  {
    formula: { type: String, required: true },
    atomCount: { type: Number, required: true },
    bondCount: { type: Number, required: true },
    totalBondOrder: { type: Number, required: true },
    composition: { type: [compositionEntrySchema], required: true, default: [] },
  },
  { _id: false, strict: true },
);

const userMoleculeSchema = new mongoose.Schema<UserMoleculeDocument>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, default: null },
    educationalDescription: { type: String, default: null },
    molecule: { type: moleculeSchema, required: true },
    editorState: { type: editorStateSchema, required: true },
    summary: { type: summarySchema, required: true },
  },
  {
    strict: true,
    collection: "user_molecules",
    timestamps: true,
  },
);

userMoleculeSchema.index({ userId: 1, updatedAt: -1 });

const UserMoleculeModel = mongoose.model<UserMoleculeDocument>("UserMolecule", userMoleculeSchema);

export default UserMoleculeModel;
export type { UserMoleculeDocument };
