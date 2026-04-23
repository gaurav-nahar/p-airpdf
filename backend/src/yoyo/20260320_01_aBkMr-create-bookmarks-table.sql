-- create bookmarks table
-- depends: 20260129_01_1jZhp-edit-highlight-table

CREATE TABLE IF NOT EXISTS bookmarks (
    id         SERIAL PRIMARY KEY,
    pdf_id     INTEGER NOT NULL REFERENCES pdf_files(id) ON DELETE CASCADE,
    user_id    VARCHAR NOT NULL,
    page_num   INTEGER NOT NULL,
    name       VARCHAR(255) NOT NULL DEFAULT '',
    case_no    VARCHAR,
    case_year  VARCHAR,
    case_type  VARCHAR,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_pdf_user    ON bookmarks(pdf_id, user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_case_fields ON bookmarks(case_no, case_year, case_type);
