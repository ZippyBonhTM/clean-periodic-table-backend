import mongoose from "mongoose";

type PeriodicTableElementDocument = {
  symbol: string;
  [key: string]: unknown;
};

type PeriodicTableDocument = {
  elements: PeriodicTableElementDocument[];
};

const periodicTableElementSchema = new mongoose.Schema<PeriodicTableElementDocument>(
  {
    symbol: { type: String, required: true },
  },
  { _id: false, strict: false },
);

const periodicTableSchema = new mongoose.Schema<PeriodicTableDocument>(
  {
    elements: { type: [periodicTableElementSchema], required: true },
  },
  {
    strict: true,
    collection: "periodic_tables",
  },
);

const PeriodicTableModel = mongoose.model<PeriodicTableDocument>(
  "PeriodicTable",
  periodicTableSchema,
);

export type { PeriodicTableDocument };
export default PeriodicTableModel;
