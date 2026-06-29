
export interface Table {
  id: string;
  table_number: number;
  table_name: string;
  seats: number;
  location?: string;
  status: string;
  company_id: string;
  created_at: string;
  shape?: string;
  type?: string;
  accessibility_friendly?: boolean;
  description?: string;
  is_active?: boolean;
  can_combine?: boolean;
  max_combine_size?: number;
  group_priority?: number;
  // Enhanced table features
  features?: any; // JSON field from database
  vip_status?: boolean;
  window_seating?: boolean;
  privacy_level?: string; // Allow any string from database
  ambiance?: string; // Allow any string from database
  is_high_top?: boolean;
  is_main_dining?: boolean;
  is_outdoor?: boolean;
  is_quiet_area?: boolean;
  is_dog_friendly?: boolean;
  is_family_friendly?: boolean;
  is_business_friendly?: boolean;
  // Service status management
  service_status?: 'available' | 'out_of_service' | 'temporarily_removed';
  // Floor plan positioning
  floor_plan_x?: number;
  floor_plan_y?: number;
  floor_plan_rotation?: number;
  floor_level?: number;
}

export type TableServiceStatus = 'available' | 'out_of_service' | 'temporarily_removed';

export interface TableGroup {
  id: string;
  company_id: string;
  group_name: string;
  description?: string;
  max_combined_capacity: number;
  is_active: boolean;
  display_order: number;
  group_priority?: number;
  advanced_settings?: AdvancedGroupSettings;
  created_at: string;
  updated_at: string;
}

export interface AdvancedGroupSettings {
  capacity_mode: 'auto' | 'manual' | 'seat_loss';
  seat_loss_per_connection: number;
  capacity_maps: Record<string, number>;
  overlap_strategy: 'prefer_exclusive' | 'allow_shared' | 'priority_based';
  contiguous_required: boolean;
  min_tables_required: number;
  allow_partial_usage: boolean;
}

export interface TableGroupMembership {
  id: string;
  table_id: string;
  group_id: string;
  priority_order: number;
  created_at: string;
}

export interface TableGroupWithTables {
  group_id: string;
  group_name: string;
  description?: string;
  max_combined_capacity: number;
  is_active: boolean;
  display_order: number;
  group_priority?: number;
  advanced_settings?: AdvancedGroupSettings;
  table_numbers: number[];
  can_combine?: boolean;
  out_of_service_tables?: number[];
}

export interface AssignmentRule {
  id: string;
  company_id: string;
  rule_name: string;
  rule_type: string;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Visual seat mapping interfaces for Phase 2
export interface SeatPosition {
  id: string;
  table_id: string;
  company_id: string;
  seat_number: number;
  x_position: number;
  y_position: number;
  seat_type: 'standard' | 'accessible' | 'high_chair' | 'booth';
  seat_status: 'available' | 'lost' | 'blocked' | 'spare';
  is_accessible: boolean;
  // Spare seat metadata
  spare_reason?: 'lost_connection' | 'manually_blocked' | 'temporary_removal';
  original_table_id?: string;
  removal_timestamp?: string;
  created_at: string;
  updated_at: string;
}

export interface GroupSeatMapping {
  id: string;
  group_id: string;
  company_id: string;
  table_combination: string[]; // Array of table IDs
  total_seats: number;
  lost_seats: number;
  connection_points?: ConnectionPoint[];
  efficiency_score: number;
  scenario_name?: string;
  is_optimal: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectionPoint {
  table_id: string;
  x: number;
  y: number;
  connected_to?: string;
}

export interface CapacityScenario {
  combination: string[];
  total_seats: number;
  lost_seats: number;
  efficiency_score: number;
  is_optimal: boolean;
  recommended_party_sizes: number[];
}

export interface TableArrangement {
  table_id: string;
  x_position: number;
  y_position: number;
  rotation: number;
  scale: number;
}

export interface AssignmentHistory {
  id: string;
  reservation_id: string;
  assigned_tables: number[];
  assignment_strategy: string;
  success: boolean;
  conflict_detected: boolean;
  rule_applied?: string;
  created_at: string;
  company_id: string;
}

export interface TableServiceSchedule {
  id: string;
  table_id: string;
  company_id: string;
  service_status: 'out_of_service' | 'temporarily_removed';
  scheduled_at: string;
  scheduled_end: string | null;
  duration_days: number | null;
  requires_attention: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TableWithSchedule extends Table {
  schedule?: TableServiceSchedule;
}

export interface TableRequiringAttention {
  schedule_id: string;
  table_id: string;
  table_number: number;
  table_name: string | null;
  service_status: string;
  scheduled_at: string;
  scheduled_end: string | null;
  duration_days: number | null;
}
