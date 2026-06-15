-- =============================================
-- Fix employees & payroll_slips column names
-- camelCase to match JS payloads (like invoices)
-- =============================================

-- ── employees ──
ALTER TABLE public.employees RENAME COLUMN salaire_base TO "salaireBase";
ALTER TABLE public.employees RENAME COLUMN nb_enfants TO "nbEnfants";
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS "regimeHoraire" INT DEFAULT 40;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS "chefFamille" BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS "conjointCharge" BOOLEAN DEFAULT false;
ALTER TABLE public.employees DROP COLUMN IF EXISTS regime;
ALTER TABLE public.employees DROP COLUMN IF EXISTS situation_famille;

-- ── payroll_slips ──
ALTER TABLE public.payroll_slips RENAME COLUMN employee_id TO "employeId";
ALTER TABLE public.payroll_slips RENAME COLUMN salaire_base TO "salaireBase";
ALTER TABLE public.payroll_slips RENAME COLUMN cnss_sal TO "cnssSal";
ALTER TABLE public.payroll_slips RENAME COLUMN cnss_pat TO "cnssPat";
ALTER TABLE public.payroll_slips RENAME COLUMN irpp TO "irppAnnuel";
ALTER TABLE public.payroll_slips RENAME COLUMN net_a_payer TO "netAPayer";
ALTER TABLE public.payroll_slips DROP COLUMN IF EXISTS cout_employeur;

-- Add extra bulletin fields not in original schema
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "cin" TEXT;
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "matricule" TEXT;
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "poste" TEXT;
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "regime" TEXT;
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "heuresSup" NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "montantHS" NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "primes" NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "fraisPro" NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "deductionsFamille" NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "revenuImposableAnnuel" NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "cssAnnuelle" NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "rsMensuelle" NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "avances" NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_slips ADD COLUMN IF NOT EXISTS "provisionCP" NUMERIC DEFAULT 0;
