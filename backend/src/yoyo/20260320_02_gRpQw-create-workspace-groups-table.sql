-- depends: 20260320_01_aBkMr-create-bookmarks-table

CREATE TABLE IF NOT EXISTS workspace_groups (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    client_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '',
    color VARCHAR(50) NOT NULL DEFAULT '#e0e7ff',
    item_ids JSONB NOT NULL DEFAULT '[]',
    collapsed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_groups_workspace_id ON workspace_groups(workspace_id);
