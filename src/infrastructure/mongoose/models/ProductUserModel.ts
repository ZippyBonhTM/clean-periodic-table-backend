import mongoose from "mongoose";

import type {
  AdminUserAccountStatus,
  AdminUserRole,
  ProductUserAccountVersion,
  ProductUserRestriction,
} from "../../../domain/Admin.js";

type ProductUserDocument = {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  accountVersion?: ProductUserAccountVersion;
  accountStatus: AdminUserAccountStatus;
  restriction: ProductUserRestriction | null;
  lastSeenAt: Date | null;
  lastSeenSortAt: Date;
  lastAuditAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const restrictionSchema = new mongoose.Schema<ProductUserRestriction>(
  {
    reason: { type: String, default: null },
    expiresAt: { type: Date, default: null },
  },
  { _id: false, strict: true },
);

const productUserSchema = new mongoose.Schema<ProductUserDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    role: { type: String, required: true, enum: ["USER", "ADMIN"], index: true },
    accountVersion: {
      type: String,
      required: true,
      enum: ["legacy", "product-v1"],
      index: true,
      default: "legacy",
    },
    accountStatus: {
      type: String,
      required: true,
      enum: ["active", "restricted", "suspended"],
      index: true,
    },
    restriction: { type: restrictionSchema, default: null },
    lastSeenAt: { type: Date, default: null },
    lastSeenSortAt: { type: Date, required: true, index: true },
    lastAuditAt: { type: Date, default: null },
  },
  {
    strict: true,
    collection: "product_users",
    timestamps: true,
  },
);

productUserSchema.index({ createdAt: -1, id: -1 });
productUserSchema.index({ lastSeenSortAt: -1, id: -1 });

const ProductUserModel = mongoose.model<ProductUserDocument>("ProductUser", productUserSchema);

export default ProductUserModel;
export type { ProductUserDocument };
