-- create_snippets_table
-- depends: 20251204_02_Zh6oZ-create-boxes-table

CREATE TABLE IF NOT EXISTS snippets (
    id         SERIAL PRIMARY KEY,
    pdf_id     INTEGER NOT NULL REFERENCES pdf_files(id) ON DELETE CASCADE,
    content    TEXT,
    file_data  BYTEA,
    type       TEXT NOT NULL,
    x          REAL NOT NULL DEFAULT 0.0,
    y          REAL NOT NULL DEFAULT 0.0,
    page       INTEGER,
    width      REAL,
    height     REAL,
    x_pct      FLOAT,
    y_pct      FLOAT,
    width_pct  FLOAT,
    height_pct FLOAT,
    case_no    VARCHAR,
    case_year  VARCHAR,
    case_type  VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_snippets_case_fields ON snippets(case_no, case_year, case_type);
