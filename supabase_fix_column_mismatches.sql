-- Fix column mismatches between local data and Supabase tables
-- The app sends camelCase columns but some tables may have snake_case

-- stock_mouvements: add prixUnitaire if it has prix_unitaire
ALTER TABLE public.stock_mouvements ADD COLUMN IF NOT EXISTS "prixUnitaire" REAL DEFAULT 0;
ALTER TABLE public.stock_mouvements ADD COLUMN IF NOT EXISTS "prix_unitaire" REAL DEFAULT 0;

-- pieces_comptables: ensure all expected columns exist
ALTER TABLE public.pieces_comptables ADD COLUMN IF NOT EXISTS "total" REAL DEFAULT 0;
ALTER TABLE public.pieces_comptables ADD COLUMN IF NOT EXISTS "totalDebit" REAL DEFAULT 0;
ALTER TABLE public.pieces_comptables ADD COLUMN IF NOT EXISTS "totalCredit" REAL DEFAULT 0;
ALTER TABLE public.pieces_comptables ADD COLUMN IF NOT EXISTS "total_debit" REAL DEFAULT 0;
ALTER TABLE public.pieces_comptables ADD COLUMN IF NOT EXISTS "total_credit" REAL DEFAULT 0;
ALTER TABLE public.pieces_comptables ADD COLUMN IF NOT EXISTS "ttnId" TEXT DEFAULT '';
ALTER TABLE public.pieces_comptables ADD COLUMN IF NOT EXISTS "ttn_id" TEXT DEFAULT '';
ALTER TABLE public.pieces_comptables ADD COLUMN IF NOT EXISTS "reference" TEXT DEFAULT '';
ALTER TABLE public.pieces_comptables ADD COLUMN IF NOT EXISTS "journal" TEXT DEFAULT '';
ALTER TABLE public.pieces_comptables ADD COLUMN IF NOT EXISTS "date" DATE DEFAULT CURRENT_DATE;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
