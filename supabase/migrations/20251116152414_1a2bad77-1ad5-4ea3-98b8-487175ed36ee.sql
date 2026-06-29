-- Migrate deals table to support multiple days per deal
-- Change day_of_week from single integer to array of integers

-- Step 1: Create a temporary column to store the new array format
ALTER TABLE deals ADD COLUMN day_of_week_temp integer[];

-- Step 2: Migrate existing single day values to array format
UPDATE deals SET day_of_week_temp = ARRAY[day_of_week];

-- Step 3: Drop the old column
ALTER TABLE deals DROP COLUMN day_of_week;

-- Step 4: Rename the temporary column to day_of_week
ALTER TABLE deals RENAME COLUMN day_of_week_temp TO day_of_week;

-- Step 5: Set the column as NOT NULL
ALTER TABLE deals ALTER COLUMN day_of_week SET NOT NULL;

-- Step 6: Add check constraint to ensure valid days (0-6) and non-empty array
ALTER TABLE deals
  ADD CONSTRAINT valid_days_of_week 
  CHECK (
    day_of_week <@ ARRAY[0,1,2,3,4,5,6]::integer[]
    AND array_length(day_of_week, 1) > 0
  );