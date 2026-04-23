-- create highlights table
-- depends: 20251218_01_EzXM1-add-column-in-snippet

CREATE TABLE IF NOT EXISTS highlights (
    id         SERIAL PRIMARY KEY,
    pdf_id     INTEGER NOT NULL REFERENCES pdf_files(id) ON DELETE CASCADE,
    page_num   INTEGER NOT NULL,
    color      TEXT NOT NULL,
    x_pct      FLOAT NOT NULL,
    y_pct      FLOAT NOT NULL,
    width_pct  FLOAT NOT NULL,
    height_pct FLOAT NOT NULL,
    content    TEXT,
    case_no    VARCHAR,
    case_year  VARCHAR,
    case_type  VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_highlights_id            ON highlights(id);
CREATE INDEX IF NOT EXISTS ix_highlights_pdf_id        ON highlights(pdf_id);
CREATE INDEX IF NOT EXISTS idx_highlights_case_fields  ON highlights(case_no, case_year, case_type);