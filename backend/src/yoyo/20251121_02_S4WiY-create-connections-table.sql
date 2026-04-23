-- create_connections_table
-- depends: 20251121_01_rJl7l-pdf_files_table

CREATE TABLE IF NOT EXISTS connections (
    id         SERIAL PRIMARY KEY,
    pdf_id     INTEGER NOT NULL REFERENCES pdf_files(id) ON DELETE CASCADE,
    source_id  BIGINT NOT NULL,
    target_id  BIGINT NOT NULL,
    meta       TEXT,
    case_no    VARCHAR,
    case_year  VARCHAR,
    case_type  VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_connections_case_fields ON connections(case_no, case_year, case_type);