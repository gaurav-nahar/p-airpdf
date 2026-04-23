-- add_lines_table
-- depends: 20251121_02_S4WiY-create-connections-table

CREATE TABLE IF NOT EXISTS lines (
    id           SERIAL PRIMARY KEY,
    pdf_id       INTEGER NOT NULL REFERENCES pdf_files(id) ON DELETE CASCADE,
    points       TEXT NOT NULL,
    color        TEXT,
    stroke_width REAL,
    case_no      VARCHAR,
    case_year    VARCHAR,
    case_type    VARCHAR,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lines_case_fields ON lines(case_no, case_year, case_type);
