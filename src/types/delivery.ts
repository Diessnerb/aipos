// Delivery Management System Types

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  category: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  order_method: 'email' | 'phone' | 'online' | 'print';
  email_template?: string;
  scheduling_mode: 'lead_time' | 'fixed_schedule';
  lead_time_days: number;
  minimum_order_value?: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliverySchedule {
  id: string;
  company_id: string;
  supplier_id: string;
  order_day_of_week: number;
  delivery_day_of_week: number;
  auto_generate_enabled: boolean;
  requires_approval: boolean;
  next_order_date?: string;
  next_delivery_date?: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryOrder {
  id: string;
  company_id: string;
  supplier_id: string;
  order_number: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'partially_received' | 'received' | 'cancelled';
  order_date: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  total_cost?: number;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  sent_at?: string;
  received_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
}

export interface DeliveryOrderItem {
  id: string;
  delivery_order_id: string;
  ingredient_id: string;
  ingredient_name: string;
  suggested_quantity?: number;
  ordered_quantity: number;
  received_quantity?: number;
  unit_cost?: number;
  total_cost?: number;
  variance_quantity?: number;
  variance_cost?: number;
  variance_notes?: string;
  variance_type?: 'received' | 'partial' | 'missing' | 'damaged';
  created_at: string;
  updated_at: string;
}

export interface IngredientUsageAnalytics {
  id: string;
  company_id: string;
  ingredient_id: string;
  usage_date: string;
  quantity_used: number;
  source: 'pos_order' | 'wastage' | 'manual_adjustment';
  order_id?: string;
  wastage_log_id?: string;
  created_at: string;
}

export interface WastageLog {
  id: string;
  company_id: string;
  wastage_date: string;
  wastage_time: string;
  location: 'kitchen' | 'bar';
  item_type: 'menu_item' | 'ingredient';
  menu_item_id?: string;
  menu_item_name?: string;
  ingredient_id?: string;
  ingredient_name?: string;
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  wastage_type: 'spoiled' | 'damaged' | 'over_prepared' | 'customer_complaint' | 'dropped' | 'expired' | 'other';
  notes?: string;
  logged_by?: string;
  created_at: string;
}

export interface MenuItemCosting {
  id: string;
  company_id: string;
  menu_item_id: string;
  ingredient_costs?: Record<string, { cost: number; quantity: number; total: number }>;
  total_ingredient_cost?: number;
  sale_price?: number;
  profit_amount?: number;
  profit_margin_percent?: number;
  last_calculated_at: string;
  price_change_alert: boolean;
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
