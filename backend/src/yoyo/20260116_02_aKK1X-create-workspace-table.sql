-- create workspace table
-- depends: 20260116_01_N6T0p-alter-all-table


CREATE TABLE IF NOT EXISTS workspaces (
    id                   SERIAL PRIMARY KEY,
    pdf_id               INTEGER REFERENCES pdf_files(id) ON DELETE CASCADE,
    name                 VARCHAR NOT NULL DEFAULT 'Default Workspace',
    cross_pdf_links_json TEXT DEFAULT '[]',
    case_no              VARCHAR,
    case_year            VARCHAR,
    case_type            VARCHAR,
    created_at           TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
    updated_at           TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspaces_case_fields ON workspaces(case_no, case_year, case_type);