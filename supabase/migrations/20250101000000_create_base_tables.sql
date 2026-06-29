CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- Base table: ai_campaign_logs
CREATE TABLE IF NOT EXISTS public.ai_campaign_logs (
  campaign_type TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input JSONB,
  output TEXT,
  user_id UUID
);


-- Base table: alisha_company_settings
CREATE TABLE IF NOT EXISTS public.alisha_company_settings (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  custom_instructions TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_enabled BOOLEAN DEFAULT false,
  personality_style TEXT,
  proactive_suggestions BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: alisha_conversations
CREATE TABLE IF NOT EXISTS public.alisha_conversations (
  company_id UUID,
  content TEXT,
  context_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT,
  user_id UUID
);


-- Base table: alisha_memory
CREATE TABLE IF NOT EXISTS public.alisha_memory (
  company_id UUID,
  confidence_score INTEGER,
  context TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  memory_key TEXT,
  memory_type TEXT,
  memory_value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  usage_count INTEGER
);


-- Base table: alisha_user_preferences
CREATE TABLE IF NOT EXISTS public.alisha_user_preferences (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  frequency INTEGER,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_observed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  preference_data JSONB,
  preference_type TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID
);


-- Base table: assets
CREATE TABLE IF NOT EXISTS public.assets (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  enhanced_file_path TEXT,
  enhancement_status TEXT,
  file_name TEXT,
  file_path TEXT,
  file_size INTEGER,
  file_type TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: assignment_history
CREATE TABLE IF NOT EXISTS public.assignment_history (
  assigned_tables INTEGER[],
  assignment_strategy TEXT,
  company_id UUID,
  conflict_detected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID,
  rule_applied TEXT,
  success BOOLEAN DEFAULT false
);


-- Base table: assignment_rules
CREATE TABLE IF NOT EXISTS public.assignment_rules (
  actions JSONB,
  company_id UUID,
  conditions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  priority INTEGER,
  rule_name TEXT,
  rule_type TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: auth_attempts
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  company_id UUID,
  email TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT,
  pin_used TEXT,
  success BOOLEAN DEFAULT false,
  user_agent TEXT
);


-- Base table: auth_rate_limits
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  attempt_count INTEGER,
  blocked_until TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT,
  window_start TEXT
);


-- Base table: brand_kit
CREATE TABLE IF NOT EXISTS public.brand_kit (
  accent_color TEXT,
  background_color TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  custom_tone_description TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  primary_color TEXT,
  primary_font TEXT,
  secondary_color TEXT,
  secondary_font TEXT,
  secondary_logo_url TEXT,
  tone_of_voice TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: channel_memberships
CREATE TABLE IF NOT EXISTS public.channel_memberships (
  can_write BOOLEAN DEFAULT false,
  channel_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID
);


-- Base table: channels
CREATE TABLE IF NOT EXISTS public.channels (
  category TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  description TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_read_only BOOLEAN DEFAULT false,
  name TEXT,
  type TEXT
);


-- Base table: companies
CREATE TABLE IF NOT EXISTS public.companies (
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  default_admin_email TEXT,
  first_admin_login_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  network_secret TEXT,
  owner_pin TEXT,
  setup_completed BOOLEAN DEFAULT false,
  setup_path TEXT,
  setup_started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT,
  subdomain TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: company_growth_metrics
CREATE TABLE IF NOT EXISTS public.company_growth_metrics (
  average_party_size INTEGER,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE,
  no_show_rate INTEGER,
  peak_hour_reservations INTEGER,
  table_turnover_rate INTEGER,
  total_covers INTEGER,
  total_reservations INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: company_permission_templates
CREATE TABLE IF NOT EXISTS public.company_permission_templates (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_data JSONB,
  template_name TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: company_settings
CREATE TABLE IF NOT EXISTS public.company_settings (
  accessible_spare_target INTEGER,
  auto_assign_tables BOOLEAN DEFAULT false,
  button_style TEXT,
  company_id UUID,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  default_location_id UUID,
  email TEXT,
  enable_time_based_group_protection BOOLEAN DEFAULT false,
  font_style TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imminent_booking_threshold_minutes INTEGER,
  large_party_lead_time_threshold_minutes INTEGER,
  last_optimized_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  logo_url TEXT,
  optimization_enabled BOOLEAN DEFAULT false,
  optimization_horizon_days INTEGER,
  optimization_mode TEXT,
  phone TEXT,
  pin_idle_timeout_seconds INTEGER,
  primary_color TEXT,
  privacy_policy_url TEXT,
  quiet_hours_end TEXT,
  quiet_hours_start TEXT,
  secondary_color TEXT,
  short_term_horizon_minutes INTEGER,
  show_allergen_disclaimer BOOLEAN DEFAULT false,
  sms_provider TEXT,
  sms_reminders_enabled BOOLEAN DEFAULT false,
  strategic_optimization_enabled BOOLEAN DEFAULT false,
  support_contact TEXT,
  terms_of_service_url TEXT,
  terms_url TEXT,
  timezone TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  website_url TEXT
);


-- Base table: company_subscription_features
CREATE TABLE IF NOT EXISTS public.company_subscription_features (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  enabled BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  feature_name TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: company_twilio_config
CREATE TABLE IF NOT EXISTS public.company_twilio_config (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  twilio_phone_number TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: copilot_logs
CREATE TABLE IF NOT EXISTS public.copilot_logs (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT,
  role TEXT,
  user_id UUID
);


-- Base table: course_checkback_feedback
CREATE TABLE IF NOT EXISTS public.course_checkback_feedback (
  checkback_timestamp TEXT,
  company_id UUID,
  course TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  feedback_notes TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_rating TEXT,
  reservation_id UUID,
  staff_user_id UUID
);


-- Base table: customer_audit_log
CREATE TABLE IF NOT EXISTS public.customer_audit_log (
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  changed_by TEXT,
  company_id UUID,
  customer_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  new_data JSONB,
  old_data JSONB,
  operation TEXT,
  reservation_id UUID,
  source TEXT
);


-- Base table: customer_communications
CREATE TABLE IF NOT EXISTS public.customer_communications (
  campaign_id UUID,
  channel TEXT,
  customer_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: customer_reservation_history
CREATE TABLE IF NOT EXISTS public.customer_reservation_history (
  actual_arrival_time TIME WITHOUT TIME ZONE,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  event_timestamp TEXT,
  event_type TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  minutes_late INTEGER,
  party_size INTEGER,
  reservation_date DATE,
  reservation_id UUID,
  scheduled_time TIME WITHOUT TIME ZONE
);


-- Base table: customers
CREATE TABLE IF NOT EXISTS public.customers (
  average_minutes_late INTEGER,
  company_id UUID,
  do_not_contact BOOLEAN DEFAULT false,
  email TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_visit TEXT,
  late_count INTEGER,
  name TEXT,
  no_show_count INTEGER,
  notes TEXT,
  phone TEXT,
  preferences TEXT[],
  sms_opt_out BOOLEAN DEFAULT false,
  sms_opt_out_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  total_spent INTEGER,
  vip_status BOOLEAN DEFAULT false,
  visits INTEGER
);


-- Base table: daily_revenue_analytics
CREATE TABLE IF NOT EXISTS public.daily_revenue_analytics (
  analytics_date DATE,
  average_order_value INTEGER,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peak_hour INTEGER,
  peak_hour_revenue INTEGER,
  table_turnover_count INTEGER,
  total_orders INTEGER,
  total_revenue INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: deal_types
CREATE TABLE IF NOT EXISTS public.deal_types (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  description TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_builtin BOOLEAN DEFAULT false,
  key TEXT,
  name TEXT,
  schema JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: deals
CREATE TABLE IF NOT EXISTS public.deals (
  applies_to TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  custom_fields JSONB,
  day_of_week INTEGER[],
  deal_name TEXT,
  deal_type TEXT,
  description TEXT,
  discount_value INTEGER,
  end_time TIME WITHOUT TIME ZONE,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  m_value INTEGER,
  menu_category_ids TEXT[],
  menu_item_ids TEXT[],
  n_value INTEGER,
  start_time TIME WITHOUT TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: delivery_order_items
CREATE TABLE IF NOT EXISTS public.delivery_order_items (
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivery_order_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID,
  ingredient_name TEXT,
  ordered_quantity INTEGER,
  received_quantity INTEGER,
  suggested_quantity INTEGER,
  total_cost INTEGER,
  unit_cost INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  variance_cost INTEGER,
  variance_notes TEXT,
  variance_quantity INTEGER,
  variance_type TEXT
);


-- Base table: delivery_orders
CREATE TABLE IF NOT EXISTS public.delivery_orders (
  actual_delivery_date DATE,
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  approved_by TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  expected_delivery_date DATE,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notes TEXT,
  order_date DATE,
  order_number TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT,
  supplier_id UUID,
  total_cost INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: delivery_schedules
CREATE TABLE IF NOT EXISTS public.delivery_schedules (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  cutoff_time TIME WITHOUT TIME ZONE,
  day_of_week INTEGER,
  delivery_time TIME WITHOUT TIME ZONE,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  order_day_of_week INTEGER,
  supplier_id UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: delivery_settings
CREATE TABLE IF NOT EXISTS public.delivery_settings (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  default_delivery_window TEXT,
  enable_auto_ordering BOOLEAN DEFAULT false,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  minimum_order_value INTEGER,
  notification_email TEXT,
  notify_on_low_stock BOOLEAN DEFAULT false,
  notify_on_order_received BOOLEAN DEFAULT false,
  order_lead_time_days INTEGER,
  preferred_delivery_day INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: group_seat_mappings
CREATE TABLE IF NOT EXISTS public.group_seat_mappings (
  company_id UUID,
  connection_points JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  efficiency_score INTEGER,
  group_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_optimal BOOLEAN DEFAULT false,
  lost_seats INTEGER,
  scenario_name TEXT,
  table_combination JSONB,
  total_seats INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: holiday_deduction_log
CREATE TABLE IF NOT EXISTS public.holiday_deduction_log (
  deducted_days INTEGER,
  holiday_request_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID
);


-- Base table: holiday_requests
CREATE TABLE IF NOT EXISTS public.holiday_requests (
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_date DATE,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notes TEXT,
  start_date DATE,
  status TEXT,
  user_id UUID
);


-- Base table: image_processing_queue
CREATE TABLE IF NOT EXISTS public.image_processing_queue (
  asset_id UUID,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  error_message TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  retry_count INTEGER,
  status TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: ingredient_usage_analytics
CREATE TABLE IF NOT EXISTS public.ingredient_usage_analytics (
  average_daily_usage INTEGER,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  date DATE,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID,
  projected_days_remaining INTEGER,
  quantity_purchased INTEGER,
  quantity_used INTEGER,
  quantity_wasted INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: ingredients
CREATE TABLE IF NOT EXISTS public.ingredients (
  allergens TEXT[],
  company_id UUID,
  cost_price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  description TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  known_as TEXT,
  last_stock_update TEXT,
  name TEXT,
  portion_size INTEGER,
  portion_type TEXT,
  purchase_price NUMERIC,
  purchase_size INTEGER,
  purchase_type TEXT,
  sale_price NUMERIC,
  stock_level INTEGER,
  stock_unit TEXT,
  supplier TEXT,
  supplier_id UUID,
  units_per_purchase INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: integrations
CREATE TABLE IF NOT EXISTS public.integrations (
  auth_token TEXT,
  company_id UUID,
  connected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB,
  refresh_token TEXT,
  service_name TEXT,
  user_id UUID
);


-- Base table: inventory
CREATE TABLE IF NOT EXISTS public.inventory (
  company_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_name TEXT,
  last_updated TEXT,
  manual_low_stock BOOLEAN DEFAULT false,
  menu_item_id UUID,
  stock_quantity INTEGER,
  threshold INTEGER,
  unit TEXT
);


-- Base table: inventory_logs
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  change_amount NUMERIC,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID,
  menu_item_name TEXT,
  notes TEXT,
  timestamp TEXT
);


-- Base table: invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  amount_paid INTEGER,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  date_paid TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT,
  invoice_number INTEGER,
  items_purchased TEXT,
  paid BOOLEAN DEFAULT false,
  supplier TEXT
);


-- Base table: kitchen_service_requests
CREATE TABLE IF NOT EXISTS public.kitchen_service_requests (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  dismissed_by TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT,
  status TEXT,
  type TEXT
);


-- Base table: link_templates
CREATE TABLE IF NOT EXISTS public.link_templates (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_structure_json JSONB,
  template_name TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: locations
CREATE TABLE IF NOT EXISTS public.locations (
  address TEXT,
  address_line TEXT,
  city TEXT,
  company_id UUID,
  country TEXT,
  county TEXT,
  district TEXT,
  email TEXT,
  full_address TEXT,
  hours JSONB,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude INTEGER,
  longitude INTEGER,
  name TEXT,
  phone TEXT,
  postcode TEXT,
  status TEXT,
  ward TEXT
);


-- Base table: manual_override_feedback
CREATE TABLE IF NOT EXISTS public.manual_override_feedback (
  additional_notes TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  feedback_reasons TEXT[],
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_timestamp TEXT,
  new_table_numbers INTEGER[],
  old_table_numbers INTEGER[],
  reservation_id UUID,
  staff_user_id UUID
);


-- Base table: marketing_analytics
CREATE TABLE IF NOT EXISTS public.marketing_analytics (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  date DATE,
  hour INTEGER,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT,
  metric_value INTEGER,
  platform TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: marketing_campaigns
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  audience_filter JSONB,
  channel TEXT,
  company_id UUID,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT,
  target_count INTEGER,
  title TEXT,
  type TEXT
);


-- Base table: marketing_permissions
CREATE TABLE IF NOT EXISTS public.marketing_permissions (
  analytics_access BOOLEAN DEFAULT false,
  automated_posting BOOLEAN DEFAULT false,
  company_id UUID,
  content_creation BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID,
  messaging_access BOOLEAN DEFAULT false,
  platform TEXT,
  post_access BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: menu_categories
CREATE TABLE IF NOT EXISTS public.menu_categories (
  card_color TEXT,
  category_type TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  description TEXT,
  display_order INTEGER,
  external_pos_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  last_pos_sync TEXT,
  name TEXT,
  parent_id UUID,
  pos_metadata JSONB,
  pos_sync_status TEXT,
  sync_conflicts JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: menu_item_ingredients
CREATE TABLE IF NOT EXISTS public.menu_item_ingredients (
  add_on_cost INTEGER,
  allergens TEXT[],
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  display_order INTEGER,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_name TEXT,
  is_included BOOLEAN DEFAULT false,
  menu_item_id UUID,
  quantity INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: menu_items
CREATE TABLE IF NOT EXISTS public.menu_items (
  allergens TEXT[],
  card_color TEXT,
  category_id UUID,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  description TEXT,
  display_order INTEGER,
  external_pos_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_urls TEXT[],
  last_pos_sync TEXT,
  name TEXT,
  pos_metadata JSONB,
  pos_sync_status TEXT,
  price NUMERIC,
  sync_conflicts JSONB,
  tags TEXT[]
);


-- Base table: messages
CREATE TABLE IF NOT EXISTS public.messages (
  channel_id UUID,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_edited BOOLEAN DEFAULT false,
  recipient_id UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID
);


-- Base table: staff_notes
CREATE TABLE IF NOT EXISTS public.staff_notes (
  author TEXT,
  body TEXT,
  category TEXT,
  company_id UUID,
  completed BOOLEAN DEFAULT false,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority TEXT,
  timestamp TEXT,
  title TEXT
);


-- Base table: oauth_states
CREATE TABLE IF NOT EXISTS public.oauth_states (
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  environment TEXT,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_system TEXT,
  state TEXT,
  user_id UUID
);


-- Base table: off_reasons
CREATE TABLE IF NOT EXISTS public.off_reasons (
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notes TEXT,
  reason TEXT,
  shift_date DATE,
  user_id UUID
);


-- Base table: optimization_decisions
CREATE TABLE IF NOT EXISTS public.optimization_decisions (
  action_taken TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  current_tables INTEGER[],
  days_ahead INTEGER,
  decision_time TIME WITHOUT TIME ZONE,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  large_tables_freed INTEGER,
  proposed_tables INTEGER[],
  reason TEXT,
  reservation_id UUID,
  strategic_score INTEGER,
  was_ai_suggested BOOLEAN DEFAULT false,
  waste_after INTEGER,
  waste_before INTEGER
);


-- Base table: optimization_log
CREATE TABLE IF NOT EXISTS public.optimization_log (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  gap_reduction_score INTEGER,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  new_table_number INTEGER,
  old_table_number INTEGER,
  optimization_session_id UUID,
  optimization_type TEXT,
  reason TEXT,
  reservation_id UUID
);


-- Base table: order_items
CREATE TABLE IF NOT EXISTS public.order_items (
  basket_item_id UUID,
  course_type TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_prepared BOOLEAN DEFAULT false,
  menu_item_id UUID,
  modifications JSONB,
  notes TEXT,
  order_id UUID,
  payment_status TEXT,
  quantity INTEGER,
  quantity_paid INTEGER,
  subtotal INTEGER,
  unit_price NUMERIC
);


-- Base table: orders
CREATE TABLE IF NOT EXISTS public.orders (
  amount_paid INTEGER,
  assignment_type TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  current_course_started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  customer_id UUID,
  customer_name TEXT,
  external_pos_order_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_ready BOOLEAN DEFAULT false,
  is_served BOOLEAN DEFAULT false,
  kitchen_status TEXT,
  location_id UUID,
  notes TEXT,
  order_number INTEGER,
  order_type TEXT,
  ordered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  payment_status TEXT,
  pos_metadata JSONB,
  pos_sync_status TEXT,
  ready_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reservation_id UUID,
  room_number TEXT,
  scheduled_for TEXT,
  sent_to_kitchen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT,
  table_number INTEGER,
  table_numbers INTEGER[],
  total_amount NUMERIC
);


-- Base table: page_permissions
CREATE TABLE IF NOT EXISTS public.page_permissions (
  access_level TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_name TEXT,
  permission_type TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: payment_items
CREATE TABLE IF NOT EXISTS public.payment_items (
  amount NUMERIC,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID,
  payment_id UUID,
  quantity INTEGER
);


-- Base table: payments
CREATE TABLE IF NOT EXISTS public.payments (
  amount NUMERIC,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method TEXT,
  order_id UUID,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  paid_by UUID,
  split_amount NUMERIC,
  split_index INTEGER,
  total_splits INTEGER
);


-- Base table: phone_agent_reservations
CREATE TABLE IF NOT EXISTS public.phone_agent_reservations (
  call_duration INTEGER,
  call_recording_url TEXT,
  called_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notes TEXT,
  phone_number TEXT,
  reservation_id UUID,
  source_post_id UUID,
  successful_booking BOOLEAN DEFAULT false
);


-- Base table: pos_credentials
CREATE TABLE IF NOT EXISTS public.pos_credentials (
  company_id UUID,
  connection_metadata JSONB,
  connection_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  encrypted_credentials JSONB,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_connected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  pos_system TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: pos_order_sync_logs
CREATE TABLE IF NOT EXISTS public.pos_order_sync_logs (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  error_details TEXT,
  external_pos_order_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  pos_data JSONB,
  sync_operation TEXT,
  sync_status TEXT,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: pos_sync_logs
CREATE TABLE IF NOT EXISTS public.pos_sync_logs (
  company_id UUID,
  conflict_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_after JSONB,
  data_before JSONB,
  entity_id UUID,
  entity_type TEXT,
  error_details TEXT,
  external_entity_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metadata JSONB,
  operation TEXT,
  pos_system TEXT,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_by TEXT,
  status TEXT,
  sync_direction TEXT
);


-- Base table: pos_sync_queue
CREATE TABLE IF NOT EXISTS public.pos_sync_queue (
  company_id UUID,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  entity_ids TEXT[],
  entity_type TEXT,
  error_details TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_retries INTEGER,
  metadata JSONB,
  operation_type TEXT,
  pos_system TEXT,
  priority INTEGER,
  retry_count INTEGER,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT
);


-- Base table: pos_table_sync_logs
CREATE TABLE IF NOT EXISTS public.pos_table_sync_logs (
  company_id UUID,
  data_after JSONB,
  data_before JSONB,
  error_details TEXT,
  external_table_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT,
  pos_system TEXT,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT,
  table_id UUID
);


-- Base table: product_links
CREATE TABLE IF NOT EXISTS public.product_links (
  base_price NUMERIC,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  display_order INTEGER,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  level INTEGER,
  menu_item_id UUID,
  option_name TEXT,
  parent_link_id UUID,
  price_modifier INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: reservation_critical_changes_audit
CREATE TABLE IF NOT EXISTS public.reservation_critical_changes_audit (
  change_source TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  changed_by TEXT,
  company_id UUID,
  field_changed TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT,
  new_value TEXT,
  old_value TEXT,
  reservation_id UUID,
  user_agent TEXT
);


-- Base table: reservation_patterns
CREATE TABLE IF NOT EXISTS public.reservation_patterns (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  day_of_week INTEGER,
  frequency_count INTEGER,
  hour_of_day INTEGER,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_size INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  week_of_year INTEGER,
  year INTEGER
);


-- Base table: reservations
CREATE TABLE IF NOT EXISTS public.reservations (
  allergens TEXT[],
  anchor_table INTEGER,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  customer_name TEXT,
  date DATE,
  desserts_served_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  email TEXT,
  end_time TIME WITHOUT TIME ZONE,
  external_id UUID,
  has_allergens BOOLEAN DEFAULT false,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_locked BOOLEAN DEFAULT false,
  last_manual_move_time TIME WITHOUT TIME ZONE,
  locked BOOLEAN DEFAULT false,
  locked_until TEXT,
  mains_served_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  party_size INTEGER,
  phone TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reservation_type TEXT,
  seated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  start_time TIME WITHOUT TIME ZONE,
  starters_served_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT,
  table_number INTEGER,
  table_numbers INTEGER[],
  time TIME WITHOUT TIME ZONE
);


-- Base table: rota_entries
CREATE TABLE IF NOT EXISTS public.rota_entries (
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  friday TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monday TEXT,
  notes TEXT,
  rota_id UUID,
  saturday TEXT,
  staff_type TEXT[],
  sunday TEXT,
  thursday TEXT,
  total_hours INTEGER,
  tuesday TEXT,
  user_id UUID,
  wednesday TEXT
);


-- Base table: rotas
CREATE TABLE IF NOT EXISTS public.rotas (
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID,
  week_end TEXT,
  week_start TEXT
);


-- Base table: seasonal_adjustments
CREATE TABLE IF NOT EXISTS public.seasonal_adjustments (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  large_party_probability INTEGER,
  party_size_multiplier INTEGER,
  season_type TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  volume_multiplier INTEGER,
  week_range INTEGER[]
);


-- Base table: security_audit_log
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  action TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  details JSONB,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT,
  resource_id UUID,
  resource_type TEXT,
  user_agent TEXT,
  user_id UUID
);


-- Base table: shift_approval_requests
CREATE TABLE IF NOT EXISTS public.shift_approval_requests (
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  day_of_week TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason TEXT,
  requested_hours INTEGER,
  requester_user_id UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_by_user_id UUID,
  shift_date DATE,
  shift_swap_request_id UUID
);


-- Base table: shift_logs
CREATE TABLE IF NOT EXISTS public.shift_logs (
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  duration_hours INTEGER,
  end_time TIME WITHOUT TIME ZONE,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time TIME WITHOUT TIME ZONE,
  user_id UUID
);


-- Base table: shift_swap_requests
CREATE TABLE IF NOT EXISTS public.shift_swap_requests (
  accepted_by_user_id UUID,
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  approved_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  day_of_week TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id UUID,
  request_type TEXT,
  requested_by_user_id UUID,
  requires_approval BOOLEAN DEFAULT false,
  shift_date DATE,
  shift_finish_time TIME WITHOUT TIME ZONE,
  shift_start_time TIME WITHOUT TIME ZONE,
  status TEXT,
  swap_with_date DATE,
  swap_with_day_of_week TEXT,
  swap_with_finish_time TIME WITHOUT TIME ZONE,
  swap_with_start_time TIME WITHOUT TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: sms_reminder_logs
CREATE TABLE IF NOT EXISTS public.sms_reminder_logs (
  company_id UUID,
  company_local_time TIME WITHOUT TIME ZONE,
  error_message TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_message TEXT,
  message_type TEXT,
  phone TEXT,
  processed_at_utc TEXT,
  reservation_id UUID,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT,
  twilio_message_sid TEXT
);


-- Base table: social_media_posts
CREATE TABLE IF NOT EXISTS public.social_media_posts (
  approval_status TEXT,
  clicks_count INTEGER,
  comments_count INTEGER,
  company_id UUID,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  cta_url TEXT,
  estimated_reach TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_urls TEXT[],
  impressions_count INTEGER,
  likes_count INTEGER,
  menu_item_id UUID,
  platform TEXT,
  post_id UUID,
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  shares_count INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  video_url TEXT,
  views_count INTEGER
);


-- Base table: super_admins
CREATE TABLE IF NOT EXISTS public.super_admins (
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  email TEXT,
  full_name TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID
);


-- Base table: supplier_categories
CREATE TABLE IF NOT EXISTS public.supplier_categories (
  color_scheme TEXT,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_default BOOLEAN DEFAULT false,
  name TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: supplier_order_items
CREATE TABLE IF NOT EXISTS public.supplier_order_items (
  cost_per_unit INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  current_quantity INTEGER,
  final_quantity INTEGER,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID,
  ingredient_name TEXT,
  pack_size TEXT,
  status TEXT,
  suggested_quantity INTEGER,
  supplier_order_id UUID
);


-- Base table: supplier_orders
CREATE TABLE IF NOT EXISTS public.supplier_orders (
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  date DATE,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT,
  total_cost INTEGER
);


-- Base table: suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  address TEXT,
  category TEXT,
  company_id UUID,
  contact_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  email TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  lead_time_days INTEGER,
  minimum_order_value INTEGER,
  name TEXT,
  notes TEXT,
  order_method TEXT,
  phone TEXT,
  scheduling_mode TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: system_default_permissions
CREATE TABLE IF NOT EXISTS public.system_default_permissions (
  access_level TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_name TEXT,
  permission_type TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: table_group_memberships
CREATE TABLE IF NOT EXISTS public.table_group_memberships (
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  group_id UUID,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority_order INTEGER,
  table_id UUID
);


-- Base table: table_groups
CREATE TABLE IF NOT EXISTS public.table_groups (
  advanced_settings JSONB,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  description TEXT,
  display_order INTEGER,
  group_name TEXT,
  group_priority INTEGER,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  max_combined_capacity INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: table_performance_metrics
CREATE TABLE IF NOT EXISTS public.table_performance_metrics (
  average_duration_minutes INTEGER,
  average_order_value INTEGER,
  average_party_size INTEGER,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metrics_date DATE,
  table_number INTEGER,
  total_orders INTEGER,
  total_revenue INTEGER,
  turnover_count INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  utilization_rate INTEGER
);


-- Base table: table_seat_positions
CREATE TABLE IF NOT EXISTS public.table_seat_positions (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_accessible BOOLEAN DEFAULT false,
  seat_number INTEGER,
  seat_type TEXT,
  table_id UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  x_position INTEGER,
  y_position INTEGER
);


-- Base table: table_service_schedules
CREATE TABLE IF NOT EXISTS public.table_service_schedules (
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  duration_days INTEGER,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notes TEXT,
  requires_attention BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_by TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  scheduled_end TEXT,
  service_status TEXT,
  table_id UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: table_utilization_analytics
CREATE TABLE IF NOT EXISTS public.table_utilization_analytics (
  assigned_table_numbers INTEGER[],
  assignment_date DATE,
  assignment_strategy TEXT,
  assignment_time TIME WITHOUT TIME ZONE,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_reason TEXT,
  opportunity_cost_score INTEGER,
  party_size INTEGER,
  reservation_id UUID,
  utilization_efficiency INTEGER,
  was_moved_manually BOOLEAN DEFAULT false
);


-- Base table: tables
CREATE TABLE IF NOT EXISTS public.tables (
  accessibility_friendly BOOLEAN DEFAULT false,
  ambiance TEXT,
  can_combine BOOLEAN DEFAULT false,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  description TEXT,
  external_pos_id UUID,
  features JSONB,
  floor_level INTEGER,
  group_priority INTEGER,
  height INTEGER,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  is_business_friendly BOOLEAN DEFAULT false,
  is_family_friendly BOOLEAN DEFAULT false,
  is_high_top BOOLEAN DEFAULT false,
  is_main_dining BOOLEAN DEFAULT false,
  is_outdoor BOOLEAN DEFAULT false,
  is_quiet_area BOOLEAN DEFAULT false,
  last_pos_sync TEXT,
  location TEXT,
  max_combine_size INTEGER,
  pos_metadata JSONB,
  pos_sync_status TEXT,
  privacy_level TEXT,
  rotation INTEGER,
  seats INTEGER,
  service_status TEXT,
  shape TEXT,
  status TEXT,
  table_name TEXT,
  table_number INTEGER,
  type TEXT,
  vip_status BOOLEAN DEFAULT false,
  width INTEGER,
  window_seating BOOLEAN DEFAULT false,
  x_position INTEGER,
  y_position INTEGER
);


-- Base table: trusted_devices
CREATE TABLE IF NOT EXISTS public.trusted_devices (
  company_id UUID,
  connection_type TEXT,
  device_id UUID,
  device_name TEXT,
  device_type TEXT,
  first_paired_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_revoked BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: users
CREATE TABLE IF NOT EXISTS public.users (
  auth_user_id UUID,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  email TEXT,
  full_name TEXT,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  is_company_admin BOOLEAN DEFAULT false,
  is_owner BOOLEAN DEFAULT false,
  password_reset_required BOOLEAN DEFAULT false,
  pin_code TEXT,
  pin_code_encrypted TEXT,
  remaining_holiday_days INTEGER,
  role TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- Base table: wastage_log
CREATE TABLE IF NOT EXISTS public.wastage_log (
  company_id UUID,
  cost_impact INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID,
  location TEXT,
  logged_by TEXT,
  notes TEXT,
  quantity INTEGER,
  reason TEXT,
  unit TEXT,
  wastage_batch_id UUID,
  wastage_time TIME WITHOUT TIME ZONE
);



-- Foreign Keys --
