-- create documentation_pages table for per-workspace rich-text notes
-- depends: 20260403_01_ensure-connections-bigint

CREATE TABLE IF NOT EXISTS documentation_pages (
    id          VARCHAR PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id     VARCHAR NOT NULL,
    title       VARCHAR NOT NULL DEFAULT 'Untitled',
    content     TEXT,
    sort_order  BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documentation_pages_workspace ON documentation_pages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documentation_pages_user ON documentation_pages(user_id);
