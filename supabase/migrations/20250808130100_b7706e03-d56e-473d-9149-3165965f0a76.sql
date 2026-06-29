-- First check what enum values currently exist and what data we have
-- Create the new enum with all the desired values
CREATE TYPE permission_type_new AS ENUM ('no_access', 'view', 'growth', 'edit', 'admin');

-- Update the table to use the new enum with inline values mapping
ALTER TABLE page_permissions ALTER COLUMN permission_type TYPE permission_type_new USING (
  CASE 
    WHEN permission_type::text = 'view' THEN 'view'::permission_type_new
    WHEN permission_type::text = 'edit' THEN 'edit'::permission_type_new
    WHEN permission_type::text = 'full_control' THEN 'admin'::permission_type_new
    ELSE 'no_access'::permission_type_new
  END
);

-- Drop the old enum and rename the new one
DROP TYPE permission_type;
ALTER TYPE permission_type_new RENAME TO permission_type;