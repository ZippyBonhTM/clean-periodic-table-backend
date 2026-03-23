import mongoose from "mongoose";

import type {
  AdminAuditAction,
  AdminAuditActor,
  AdminAuditTarget,
} from "../../../domain/Admin.js";

type AdminAuditDocument = {
  action: AdminAuditAction;
  summary: string;
  occurredAt: Date;
  actor: AdminAuditActor;
  target: AdminAuditTarget | null;
  ipAddress: string | null;
};

const actorSchema = new mongoose.Schema<AdminAuditActor>(
  {
    id: { type: String, default: null },
    name: { type: String, default: null },
    email: { type: String, default: null },
  },
  { _id: false, strict: true },
);

const targetSchema = new mongoose.Schema<AdminAuditTarget>(
  {
    id: { type: String, default: null },
    name: { type: String, default: null },
    email: { type: String, default: null },
  },
  { _id: false, strict: true },
);

const adminAuditSchema = new mongoose.Schema<AdminAuditDocument>(
  {
    action: {
      type: String,
      required: true,
      enum: ["role_change", "moderation", "session_revoke", "directory_sync", "access_check"],
      index: true,
    },
    summary: { type: String, required: true },
    occurredAt: { type: Date, required: true, index: true },
    actor: { type: actorSchema, required: true },
    target: { type: targetSchema, default: null },
    ipAddress: { type: String, default: null },
  },
  {
    strict: true,
    collection: "admin_audit",
    timestamps: false,
  },
);

adminAuditSchema.index({ occurredAt: -1, _id: -1 });

const AdminAuditModel = mongoose.model<AdminAuditDocument>("AdminAudit", adminAuditSchema);

export default AdminAuditModel;
export type { AdminAuditDocument };
