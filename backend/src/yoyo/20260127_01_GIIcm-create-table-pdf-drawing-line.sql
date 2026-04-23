-- create table pdf drawing line
-- depends: 20260121_01_SBXBB-create-pdf-text-table

CREATE TABLE IF NOT EXISTS pdf_drawing_lines (
    id           SERIAL PRIMARY KEY,
    pdf_id       INTEGER NOT NULL,
    page_num     INTEGER NOT NULL,
    points       TEXT NOT NULL,
    color        TEXT DEFAULT 'black',
    stroke_width DOUBLE PRECISION DEFAULT 2.0,
    case_no      VARCHAR,
    case_year    VARCHAR,
    case_type    VARCHAR,
    created_at   TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_pdf_drawing_lines_pdf
        FOREIGN KEY (pdf_id)
        REFERENCES pdf_files (id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pdf_drawing_lines_case_fields ON pdf_drawing_lines(case_no, case_year, case_type);
