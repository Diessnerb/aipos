/**
 * Temporary type definitions for delivery tables
 * These will be replaced once Supabase regenerates types
 */

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string;
  order_method: 'email' | 'phone' | 'online' | 'print';
  email_template: string | null;
  scheduling_mode: 'lead_time' | 'fixed_schedule';
  lead_time_days: number;
  minimum_order_value: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliverySchedule {
  id: string;
  company_id: string;
  supplier_id: string;
  order_day_of_week: number;
  day_of_week: number;
  delivery_time: string | null;
  cutoff_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryOrder {
  id: string;
  company_id: string;
  supplier_id: string;
  order_number: string;
  order_date: string;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'partially_received' | 'received' | 'cancelled';
  total_cost: number;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryOrderItem {
  id: string;
  company_id: string;
  order_id: string;
  ingredient_id: string;
  quantity_ordered: number;
  quantity_received: number | null;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngredientUsageAnalytics {
  id: string;
  company_id: string;
  ingredient_id: string;
  date: string;
  quantity_used: number;
  quantity_wasted: number;
  quantity_purchased: number;
  average_daily_usage: number | null;
  projected_days_remaining: number | null;
  created_at: string;
  updated_at: string;
}

export interface WastageLog {
  id: string;
  company_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  reason: 'expired' | 'damaged' | 'overproduction' | 'customer_return' | 'other';
  cost_impact: number;
  location: 'kitchen' | 'bar';
  notes: string | null;
  logged_by: string | null;
  wastage_time: string;
  created_at: string;
  ingredient?: {
    name: string;
    supplier: string | null;
    known_as: string | null;
    portion_type: string;
    cost_price: number | null;
    purchase_price: number | null;
    purchase_size: number | null;
    purchase_type: string | null;
    portion_size: number;
    units_per_purchase: number | null;
  };
  logged_by_user?: {
    full_name: string;
    email: string;
  };
}

export interface MenuItemCosting {
  id: string;
  company_id: string;
  menu_item_id: string;
  total_ingredient_cost: number;
  suggested_price: number;
  target_margin_percentage: number;
  actual_margin_percentage: number | null;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

export interface DeliverySettings {
  id: string;
  company_id: string;
  auto_generate_orders: boolean;
  require_approval: boolean;
  auto_stock_deduction: boolean;
  track_wastage: boolean;
  enable_fifo_tracking: boolean;
  enable_shelf_life_alerts: boolean;
  low_stock_threshold_days: number;
  lead_time_buffer_days: number;
  profit_margin_alert_threshold: number;
  created_at: string;
  updated_at: string;
}
