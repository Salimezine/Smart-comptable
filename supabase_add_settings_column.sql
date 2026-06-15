-- Add settings JSONB column to companies table for storing companyDetails fields
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
