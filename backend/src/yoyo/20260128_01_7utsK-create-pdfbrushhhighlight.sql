-- create pdfbrushhhighlight
-- depends: 20260127_01_GIIcm-create-table-pdf-drawing-line

CREATE TABLE IF NOT EXISTS pdf_brush_highlights (
    id          SERIAL PRIMARY KEY,
    pdf_id      INTEGER NOT NULL,
    page_num    INTEGER NOT NULL,
    path_data   TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#FFEB3B',
    brush_width DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    case_no     VARCHAR,
    case_year   VARCHAR,
    case_type   VARCHAR,
    created_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_pdf_brush_highlights_pdf
        FOREIGN KEY (pdf_id)
        REFERENCES pdf_files (id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pdf_brush_highlights_pdf_id   ON pdf_brush_highlights(pdf_id);
CREATE INDEX IF NOT EXISTS idx_pdf_brush_highlights_page_num ON pdf_brush_highlights(page_num);
CREATE INDEX IF NOT EXISTS idx_pdf_brush_highlights_case     ON pdf_brush_highlights(case_no, case_year, case_type);