-- Fix priority order for "Hello" table group
-- Current issue: T10 and T14 both have priority_order = 0 (duplicate)
-- Need to establish logical consecutive order: T10(0), T11(1), T12(2), T14(3)

-- Update Table 10 to priority 0
UPDATE table_group_memberships
SET priority_order = 0
WHERE group_id = (SELECT id FROM table_groups WHERE group_name = 'Hello' LIMIT 1)
  AND table_id = (SELECT id FROM tables WHERE table_number = 10 LIMIT 1);

-- Update Table 11 to priority 1
UPDATE table_group_memberships
SET priority_order = 1
WHERE group_id = (SELECT id FROM table_groups WHERE group_name = 'Hello' LIMIT 1)
  AND table_id = (SELECT id FROM tables WHERE table_number = 11 LIMIT 1);

-- Update Table 12 to priority 2
UPDATE table_group_memberships
SET priority_order = 2
WHERE group_id = (SELECT id FROM table_groups WHERE group_name = 'Hello' LIMIT 1)
  AND table_id = (SELECT id FROM tables WHERE table_number = 12 LIMIT 1);

-- Update Table 14 to priority 3
UPDATE table_group_memberships
SET priority_order = 3
WHERE group_id = (SELECT id FROM table_groups WHERE group_name = 'Hello' LIMIT 1)
  AND table_id = (SELECT id FROM tables WHERE table_number = 14 LIMIT 1);