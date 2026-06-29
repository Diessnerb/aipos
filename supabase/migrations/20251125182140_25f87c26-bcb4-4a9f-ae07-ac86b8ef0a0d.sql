-- Grant super admins full access to company_settings
CREATE POLICY "Super admins can manage all company settings"
  ON public.company_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins sa 
      WHERE sa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins sa 
      WHERE sa.user_id = auth.uid()
    )
  );

-- Grant super admins full access to delivery_settings
CREATE POLICY "Super admins can manage all delivery settings"
  ON public.delivery_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins sa 
      WHERE sa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins sa 
      WHERE sa.user_id = auth.uid()
    )
  );