-- Add is_active column to workspace_pdfs
-- depends: 20260116_02_aKK1X-create-workspace-table

ALTER TABLE workspace_pdfs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
