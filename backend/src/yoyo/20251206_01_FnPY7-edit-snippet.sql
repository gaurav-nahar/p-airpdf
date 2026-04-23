-- edit snippet
-- depends: 20251204_03_Mc61i-create-snippet-table

-- Add file_data column to snippets
ALTER TABLE snippets
ADD COLUMN IF NOT EXISTS file_data BYTEA;
