import type {
  AdminAuditAction,
  AdminAuditActor,
  AdminAuditRecord,
  AdminAuditTarget,
  AdminCursorPage,
} from "../../domain/Admin.js";

export type AppendAdminAuditInput = {
  action: AdminAuditAction;
  summary: string;
  actor: AdminAuditActor;
  target: AdminAuditTarget | null;
  ipAddress: string | null;
  occurredAt?: Date;
};

export type ListAdminAuditInput = {
  cursor?: string | null;
  limit: number;
  query?: string | null;
  action?: AdminAuditAction | "all" | null;
};

export default interface AdminAuditRepository {
  append(input: AppendAdminAuditInput): Promise<AdminAuditRecord>;
  list(input: ListAdminAuditInput): Promise<AdminCursorPage<AdminAuditRecord>>;
}
