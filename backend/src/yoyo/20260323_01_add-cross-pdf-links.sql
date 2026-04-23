-- Add cross_pdf_links_json column to workspaces for persisting LiquidText-style wires
-- depends: 20260116_01_N6T0p-alter-all-table

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS cross_pdf_links_json TEXT DEFAULT '[]';
