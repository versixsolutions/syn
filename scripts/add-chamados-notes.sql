-- Migration: Add internal_notes column to chamados table
-- Purpose: Allow admin to add internal notes to support tickets
-- Status: Run this on Supabase SQL Editor

-- Add internal_notes column if it doesn't exist
ALTER TABLE chamados 
ADD COLUMN IF NOT EXISTS internal_notes TEXT NULL;

-- Add comment to the column
COMMENT ON COLUMN chamados.internal_notes IS 'Internal notes only visible to administrators';

-- Verify the table structure
-- SELECT * FROM chamados LIMIT 1;
