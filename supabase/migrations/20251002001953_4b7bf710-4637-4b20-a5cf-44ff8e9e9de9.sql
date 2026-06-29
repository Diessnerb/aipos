
-- Fix priority order for Party Table 1: swap tables 6 and 7 to match logical sequence
-- Current: T1(0), T2(1), T5(2), T7(3), T6(4)
-- Fixed:   T1(0), T2(1), T5(2), T6(3), T7(4)

UPDATE table_group_memberships
SET priority_order = 3
WHERE group_id = '1b2c1490-60a7-43cd-9363-b1065138f9d1'
  AND table_id = '17181d32-6625-4475-b298-e627cac028f5'; -- Table 6

UPDATE table_group_memberships
SET priority_order = 4
WHERE group_id = '1b2c1490-60a7-43cd-9363-b1065138f9d1'
  AND table_id = 'f3158f9b-70f1-4aa6-855f-5aebc5cf39b7'; -- Table 7
