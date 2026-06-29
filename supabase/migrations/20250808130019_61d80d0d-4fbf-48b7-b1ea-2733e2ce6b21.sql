-- Update the permission_type enum to include new values
ALTER TYPE permission_type ADD VALUE IF NOT EXISTS 'no_access';
ALTER TYPE permission_type ADD VALUE IF NOT EXISTS 'growth';
ALTER TYPE permission_type ADD VALUE IF NOT EXISTS 'admin';

-- Migrate existing data to new permission types
-- 'none' -> 'no_access'
UPDATE page_permissions SET permission_type = 'no_access' WHERE permission_type = 'none';

-- 'full_control' -> 'admin' 
UPDATE page_permissions SET permission_type = 'admin' WHERE permission_type = 'full_control';

-- Remove old enum values (PostgreSQL doesn't support direct removal, so we need to recreate the enum)
-- First create a new enum with only the desired values
CREATE TYPE permission_type_new AS ENUM ('no_access', 'view', 'growth', 'edit', 'admin');

-- Update the table to use the new enum
ALTER TABLE page_permissions ALTER COLUMN permission_type TYPE permission_type_new USING permission_type::text::permission_type_new;

-- Drop the old enum and rename the new one
DROP TYPE permission_type;
ALTER TYPE permission_type_new RENAME TO permission_type;