import type { Generated } from "kysely";

export interface User {
  id: Generated<string>;
  email: string;
  password_hash: string;
  name: string;
  role: Generated<"admin" | "accountant" | "client">;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface Company {
  id: Generated<string>;
  user_id: string;
  name: string;
  tax_id: string;
  address: string | null;
  category_code: string | null;
  rne: string | null;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface Invoice {
  id: Generated<string>;
  company_id: string;
  invoice_number: string;
  client_name: string;
  client_tax_id: string;
  lines: unknown;
  totals: unknown;
  status: Generated<"DRAFT" | "VALIDATED" | "SENT" | "CANCELLED">;
  teif_status: Generated<"NONE" | "PENDING" | "SIGNED" | "ACCEPTED" | "REJECTED" | "FAILED" | "TTN_PENDING">;
  teif_xml: string | null;
  middleware_document_id: string | null;
  issue_date: string;
  due_date: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface AuditLog {
  id: Generated<string>;
  user_id: string | null;
  company_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: unknown;
  ip_address: string | null;
  created_at: Generated<Date>;
}

export interface WebhookEvent {
  id: Generated<string>;
  source: string;
  event_type: string;
  invoice_number: string | null;
  payload: unknown;
  status: Generated<"RECEIVED" | "PROCESSED" | "FAILED">;
  error: string | null;
  processed_at: Date | null;
  created_at: Generated<Date>;
}

export interface DB {
  users: User;
  companies: Company;
  invoices: Invoice;
  audit_logs: AuditLog;
  webhook_events: WebhookEvent;
}
