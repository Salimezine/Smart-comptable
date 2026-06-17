-- Add TEIF columns to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS teif_status TEXT DEFAULT 'NONE';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS teif_xml TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS middleware_document_id TEXT;

-- Add constraint for valid TEIF statuses
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_teif_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_teif_status_check
  CHECK (teif_status IN ('NONE', 'PENDING', 'SIGNED', 'ACCEPTED', 'REJECTED', 'FAILED', 'TTN_PENDING'));
