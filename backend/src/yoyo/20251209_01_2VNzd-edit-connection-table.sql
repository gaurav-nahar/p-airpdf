-- edit connection table
-- depends: 20251206_01_FnPY7-edit-snippet

ALTER TABLE connections ALTER COLUMN source_id TYPE BIGINT;
ALTER TABLE connections ALTER COLUMN target_id TYPE BIGINT;
