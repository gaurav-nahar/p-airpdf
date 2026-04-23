-- alter all table
-- depends: 20260109_01_ssbQw-create-highlights-table

ALTER TABLE boxes ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE lines ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE snippets ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE connections ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
-- 3. (Optional but Safe) Create Default Workspace for existing PDFs to avoid NULL issues
-- Insert default workspace for every PDF that doesn't have one
INSERT INTO workspaces (pdf_id, name)
SELECT id, 'Default Workspace' FROM pdf_files
WHERE id NOT IN (SELECT pdf_id FROM workspaces);
-- 4. Map existing data to the new Default Workspaces
-- Update Boxes
UPDATE boxes b
SET workspace_id = w.id
FROM workspaces w
WHERE b.pdf_id = w.pdf_id AND b.workspace_id IS NULL;
-- Update Lines
UPDATE lines l
SET workspace_id = w.id
FROM workspaces w
WHERE l.pdf_id = w.pdf_id AND l.workspace_id IS NULL;
-- Update Snippets
UPDATE snippets s
SET workspace_id = w.id
FROM workspaces w
WHERE s.pdf_id = w.pdf_id AND s.workspace_id IS NULL;
-- Update Connections
UPDATE connections c
SET workspace_id = w.id
FROM workspaces w
WHERE c.pdf_id = w.pdf_id AND c.workspace_id IS NULL;
-- 5. Finally, make columns NOT NULL (after backfilling)
ALTER TABLE boxes ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE lines ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE snippets ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE connections ALTER COLUMN workspace_id SET NOT NULL;
