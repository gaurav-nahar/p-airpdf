-- MASTER FIX SQL SCRIPT FOR 'liq' DATABASE
-- This script ensures ALL tables and mandatory columns exist before isolation logic.
-- Run this in DBeaver/pgAdmin against the 'liq' database.

DO $$ 
BEGIN 
    -- 1. Ensure basic tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') THEN
        CREATE TABLE workspaces (
            id SERIAL PRIMARY KEY,
            pdf_id INTEGER NOT NULL REFERENCES pdf_files(id) ON DELETE CASCADE,
            name VARCHAR NOT NULL DEFAULT 'Initial Workspace',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;

    -- 2. Ensure Snippets has x_pct, etc.
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'snippets') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='snippets' AND column_name='x_pct') THEN
            ALTER TABLE snippets ADD COLUMN x_pct FLOAT, ADD COLUMN y_pct FLOAT, ADD COLUMN width_pct FLOAT, ADD COLUMN height_pct FLOAT;
        END IF;
    END IF;

    -- 3. Ensure user_id and workspace_id exist on all relevant tables
    -- Workspaces
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workspaces' AND column_name='user_id') THEN
        ALTER TABLE workspaces ADD COLUMN user_id VARCHAR;
    END IF;

    -- Highlights
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='highlights' AND column_name='user_id') THEN
        ALTER TABLE highlights ADD COLUMN user_id VARCHAR;
    END IF;

    -- Boxes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='boxes' AND column_name='user_id') THEN
        ALTER TABLE boxes ADD COLUMN user_id VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='boxes' AND column_name='workspace_id') THEN
        ALTER TABLE boxes ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;

    -- Lines
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lines' AND column_name='user_id') THEN
        ALTER TABLE lines ADD COLUMN user_id VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lines' AND column_name='workspace_id') THEN
        ALTER TABLE lines ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;

    -- Snippets
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='snippets' AND column_name='user_id') THEN
        ALTER TABLE snippets ADD COLUMN user_id VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='snippets' AND column_name='workspace_id') THEN
        ALTER TABLE snippets ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;

    -- Connections
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='connections' AND column_name='user_id') THEN
        ALTER TABLE connections ADD COLUMN user_id VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='connections' AND column_name='workspace_id') THEN
        ALTER TABLE connections ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;

END $$;

-- 4. FILL DEFAULT DATA & ENFORCE NOT NULL
UPDATE workspaces SET user_id = 'legacy_user' WHERE user_id IS NULL;
UPDATE snippets SET user_id = 'legacy_user' WHERE user_id IS NULL;
UPDATE boxes SET user_id = 'legacy_user' WHERE user_id IS NULL;
UPDATE lines SET user_id = 'legacy_user' WHERE user_id IS NULL;
UPDATE connections SET user_id = 'legacy_user' WHERE user_id IS NULL;
UPDATE highlights SET user_id = 'legacy_user' WHERE user_id IS NULL;

-- Backfill workspace_id
UPDATE boxes b SET workspace_id = w.id FROM workspaces w WHERE b.pdf_id = w.pdf_id AND b.workspace_id IS NULL;
UPDATE lines l SET workspace_id = w.id FROM workspaces w WHERE l.pdf_id = w.pdf_id AND l.workspace_id IS NULL;
UPDATE snippets s SET workspace_id = w.id FROM workspaces w WHERE s.pdf_id = w.pdf_id AND s.workspace_id IS NULL;
UPDATE connections c SET workspace_id = w.id FROM workspaces w WHERE c.pdf_id = w.pdf_id AND c.workspace_id IS NULL;

-- Enforce NOT NULL
ALTER TABLE workspaces ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE snippets ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE boxes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE lines ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE connections ALTER COLUMN user_id SET NOT NULL;

-- 5. Fix any other missing tables if needed (pdf_texts, etc.)
ALTER TABLE pdf_texts ADD COLUMN IF NOT EXISTS user_id VARCHAR;
ALTER TABLE pdf_drawing_lines ADD COLUMN IF NOT EXISTS user_id VARCHAR;
ALTER TABLE pdf_brush_highlights ADD COLUMN IF NOT EXISTS user_id VARCHAR;

UPDATE pdf_texts SET user_id = 'legacy_user' WHERE user_id IS NULL;
UPDATE pdf_drawing_lines SET user_id = 'legacy_user' WHERE user_id IS NULL;
UPDATE pdf_brush_highlights SET user_id = 'legacy_user' WHERE user_id IS NULL;
