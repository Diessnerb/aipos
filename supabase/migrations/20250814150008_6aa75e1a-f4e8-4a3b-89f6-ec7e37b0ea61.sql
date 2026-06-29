-- Enable RLS on system_default_permissions table
ALTER TABLE system_default_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for system_default_permissions
-- Only super admins can manage system defaults
CREATE POLICY "Super admins can manage system default permissions"
  ON system_default_permissions
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- All authenticated users can read system defaults (needed for reset function)
CREATE POLICY "Authenticated users can view system default permissions"
  ON system_default_permissions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);