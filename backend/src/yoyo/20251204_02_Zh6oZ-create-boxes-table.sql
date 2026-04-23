-- create_boxes_table
-- depends: 20251204_01_6eJ5L-add-lines-table

CREATE TABLE IF NOT EXISTS boxes (
    id         SERIAL PRIMARY KEY,
    pdf_id     INTEGER NOT NULL REFERENCES pdf_files(id) ON DELETE CASCADE,
    text       TEXT,
    x          REAL NOT NULL DEFAULT 0.0,
    y          REAL NOT NULL DEFAULT 0.0,
    width      REAL NOT NULL DEFAULT 100.0,
    height     REAL NOT NULL DEFAULT 50.0,
    case_no    VARCHAR,
    case_year  VARCHAR,
    case_type  VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_boxes_case_fields ON boxes(case_no, case_year, case_type);