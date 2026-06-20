-- Add missing 'total' column to pieces_comptables
ALTER TABLE public.pieces_comptables ADD COLUMN IF NOT EXISTS total REAL DEFAULT 0;
