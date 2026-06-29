export const DEFAULT_BRANDING_SETTINGS = {
  primary_color: '#6B7280', // Grey-500 - sophisticated neutral
  secondary_color: '#9CA3AF', // Grey-400 - lighter complementary grey
  font_style: 'inter',
  button_style: 'rounded',
  show_allergen_disclaimer: true
};

// Helper to get default settings for new companies
export const getDefaultCompanySettings = () => ({
  auto_assign_tables: true,
  optimization_enabled: true,
  optimization_mode: 'continuous',
  optimization_horizon_days: 90,
  quiet_hours_start: '00:00:00',
  quiet_hours_end: '06:00:00',
  strategic_optimization_enabled: true,
  pin_idle_timeout_seconds: 900, // 15 minutes minimum for tablet stability
  ...DEFAULT_BRANDING_SETTINGS
});