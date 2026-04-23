-- ensure connections endpoint ids can hold large values
-- depends: 20260402_02_WsPdf-case-workspace

ALTER TABLE connections ALTER COLUMN source_id TYPE BIGINT;
ALTER TABLE connections ALTER COLUMN target_id TYPE BIGINT;
