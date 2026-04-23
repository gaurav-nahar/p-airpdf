-- add column in snippet
-- depends: 20251209_01_2VNzd-edit-connection-table

ALTER TABLE snippets ADD COLUMN IF NOT EXISTS x_pct FLOAT;
ALTER TABLE snippets ADD COLUMN IF NOT EXISTS y_pct FLOAT;
ALTER TABLE snippets ADD COLUMN IF NOT EXISTS width_pct FLOAT;
ALTER TABLE snippets ADD COLUMN IF NOT EXISTS height_pct FLOAT;
