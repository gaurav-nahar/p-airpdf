-- add column in snippet
-- depends: 20251209_01_2VNzd-edit-connection-table

-- add column in snippet
-- depends: 20251209_01_2VNzd-edit-connection-table

ALTER TABLE snippets 
ADD COLUMN x_pct FLOAT, 
ADD COLUMN y_pct FLOAT, 
ADD COLUMN width_pct FLOAT, 
ADD COLUMN height_pct FLOAT;