-- Add workspace_pdfs table for persistent multi-PDF case workspaces
-- depends: 20260402_01_add-case-columns

CREATE TABLE IF NOT EXISTS workspace_pdfs (
    id           BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    pdf_id       BIGINT NOT NULL REFERENCES pdf_files(id) ON DELETE CASCADE,
    pdf_name     VARCHAR,
    pdf_url      TEXT,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE(workspace_id, pdf_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_pdfs_workspace ON workspace_pdfs(workspace_id);
