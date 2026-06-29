
-- Find all duplicate week_start values in the rotas table
SELECT week_start, COUNT(*) as num_rotas
FROM public.rotas
GROUP BY week_start
HAVING COUNT(*) > 1;

-- View all rotas for the most common duplicate week_start date
-- (Update '2025-06-09' below to match any date you want to investigate)
SELECT *
FROM public.rotas
WHERE week_start = '2025-06-09';

-- After determining which IDs to keep, delete the unnecessary ones.
-- Example: DELETE all but one for week_start = '2025-06-09'
-- Be sure to keep the correct row (update the UUIDs below for your actual data).

-- DELETE FROM public.rotas WHERE id = 'ID_TO_DELETE';

-- Once you've cleaned up all duplicate week_start rows,
-- you can retry adding the UNIQUE constraint.
