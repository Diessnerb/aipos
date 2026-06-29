
-- Fix priority order for Party Table 1 group to be [3, 4, 5, 6, 7]
-- Current order is [5, 6, 7, 3, 4] which causes contiguity issues

-- Update priorities to logical order
UPDATE table_group_memberships
SET priority_order = CASE 
  WHEN table_id = '4ab091f1-af73-487a-9661-9b9218e8d4b2' THEN 0  -- Table 3
  WHEN table_id = '36430699-9177-4a02-b381-fa7f97732922' THEN 1  -- Table 4
  WHEN table_id = '50fa550a-15b3-4cc6-9f34-cf3fe05d8ee7' THEN 2  -- Table 5
  WHEN table_id = '17181d32-6625-4475-b298-e627cac028f5' THEN 3  -- Table 6
  WHEN table_id = 'f3158f9b-70f1-4aa6-855f-5aebc5cf39b7' THEN 4  -- Table 7
END
WHERE group_id = '1b2c1490-60a7-43cd-9363-b1065138f9d1'
  AND table_id IN (
    '4ab091f1-af73-487a-9661-9b9218e8d4b2',  -- Table 3
    '36430699-9177-4a02-b381-fa7f97732922',  -- Table 4
    '50fa550a-15b3-4cc6-9f34-cf3fe05d8ee7',  -- Table 5
    '17181d32-6625-4475-b298-e627cac028f5',  -- Table 6
    'f3158f9b-70f1-4aa6-855f-5aebc5cf39b7'   -- Table 7
  );
