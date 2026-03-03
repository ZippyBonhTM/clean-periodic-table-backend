import mongoose from "mongoose";

import type { ElementImage, ElementProps } from "../../../domain/Element.js";

type ElementDocument = ElementProps;

const imageSchema = new mongoose.Schema<ElementImage>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    attribution: { type: String, required: true },
  },
  { _id: false, strict: true },
);

const elementSchema = new mongoose.Schema<ElementDocument>(
  {
    name: { type: String, required: true, unique: true },
    appearance: { type: String, default: null },
    atomic_mass: { type: Number, required: true },
    boil: { type: Number, default: null },
    category: { type: String, required: true },
    density: { type: Number, default: null },
    discovered_by: { type: String, default: null },
    melt: { type: Number, default: null },
    molar_heat: { type: Number, default: null },
    named_by: { type: String, default: null },
    number: { type: Number, required: true },
    period: { type: Number, required: true },
    group: { type: Number, required: true },
    phase: { type: String, required: true },
    source: { type: String, required: true },
    bohr_model_image: { type: String, default: null },
    bohr_model_3d: { type: String, default: null },
    spectral_img: { type: String, default: null },
    summary: { type: String, required: true },
    symbol: { type: String, required: true, unique: true },
    xpos: { type: Number, required: true },
    ypos: { type: Number, required: true },
    wxpos: { type: Number, required: true },
    wypos: { type: Number, required: true },
    shells: { type: [Number], required: true },
    electron_configuration: { type: String, required: true },
    electron_configuration_semantic: { type: String, required: true },
    electron_affinity: { type: Number, default: null },
    electronegativity_pauling: { type: Number, default: null },
    ionization_energies: { type: [Number], required: true },
    cpk_hex: { type: String, default: null },
    image: { type: imageSchema, required: true },
    block: { type: String, required: true },
  },
  {
    strict: true,
    collection: "elements",
  },
);

const ElementModel = mongoose.model<ElementDocument>("Element", elementSchema);

export default ElementModel;
export type { ElementDocument };
