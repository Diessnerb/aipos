-- Create the new enum with all the desired values
CREATE TYPE permission_type_new AS ENUM ('no_access', 'view', 'growth', 'edit', 'admin');

-- Add a temporary column with the new enum type
ALTER TABLE page_permissions ADD COLUMN permission_type_temp permission_type_new;

-- Migrate data to the new column
UPDATE page_permissions SET permission_type_temp = 
  CASE 
    WHEN permission_type::text = 'view' THEN 'view'::permission_type_new
    WHEN permission_type::text = 'edit' THEN 'edit'::permission_type_new  
    WHEN permission_type::text = 'full_control' THEN 'admin'::permission_type_new
    ELSE 'no_access'::permission_type_new  -- Default fallback
  END;

-- Drop the old column and rename the new one
ALTER TABLE page_permissions DROP COLUMN permission_type;
ALTER TABLE page_permissions RENAME COLUMN permission_type_temp TO permission_type;

-- Make the column NOT NULL
ALTER TABLE page_permissions ALTER COLUMN permission_type SET NOT NULL;

-- Drop the old enum and rename the new one  
DROP TYPE permission_type;
ALTER TYPE permission_type_new RENAME TO permission_type;