-- =============================================
-- Smart Comptable — Fix column names (JS camelCase ↔ DB)
-- Exécuter dans Supabase Dashboard > SQL Editor
-- =============================================

-- journal_entries
ALTER TABLE public.journal_entries RENAME COLUMN numero_piece TO "numeroPiece";
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS "ttnId" TEXT;

-- expenses
ALTER TABLE public.expenses RENAME COLUMN total_amount TO "totalAmount";
ALTER TABLE public.expenses RENAME COLUMN vat_rate TO "vatAmount";
ALTER TABLE public.expenses RENAME COLUMN matricule_fiscal TO "matriculeFiscal";
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS "subtotal" NUMERIC DEFAULT 0;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS "fodec" NUMERIC DEFAULT 0;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS "stampDuty" NUMERIC DEFAULT 0;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS "rsAmount" NUMERIC DEFAULT 0;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PENDING';

-- invoices
ALTER TABLE public.invoices RENAME COLUMN invoice_number TO "invoiceNumber";
ALTER TABLE public.invoices RENAME COLUMN client_name TO "clientName";
ALTER TABLE public.invoices RENAME COLUMN client_email TO "clientEmail";
ALTER TABLE public.invoices RENAME COLUMN client_vat TO "clientVat";
ALTER TABLE public.invoices RENAME COLUMN client_address TO "clientAddress";
ALTER TABLE public.invoices RENAME COLUMN issue_date TO "issueDate";
ALTER TABLE public.invoices RENAME COLUMN due_date TO "dueDate";
ALTER TABLE public.invoices RENAME COLUMN vat_amount TO "vatAmount";
ALTER TABLE public.invoices RENAME COLUMN total_amount TO "totalAmount";
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "subtotal" NUMERIC DEFAULT 0;
