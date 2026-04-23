-- edit highlight table
-- depends: 20260128_01_7utsK-create-pdfbrushhhighlight

ALTER TABLE highlights
ADD COLUMN content TEXT;
