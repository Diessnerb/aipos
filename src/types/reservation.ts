
export interface Reservation {
  id: string;
  company_id?: string;
  customer_name: string;
  phone: string;
  email: string;
  party_size: number;
  date: string;
  time: string;
  end_time?: string;
  table_number?: number;
  table_numbers?: number[]; // Array for multi-table reservations
  notes?: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'no-show' | 'completed' | 'late' | 'seated' |
    'waiting-for-order' | 'waiting-for-starters' | 'starters-ready-in-kitchen' | 'starters-served' |
    'requires-check-back-on-starters' | 'eating-starters' | 'clear-starters' | 'waiting-for-mains' |
    'mains-ready-in-kitchen' | 'mains-served' | 'requires-check-back-on-mains' | 'eating-mains' |
    'clear-mains' | 'waiting-for-desserts' | 'desserts-ready-in-kitchen' | 'desserts-served' |
    'requires-check-back-on-desserts' | 'eating-dessert' | 'clear-desserts' | 'table-cleared' |
    'bill-requested-waiting-to-pay' | 'table-complete';
  reservation_type?: 'standard' | 'last_minute';
  locked?: boolean;
  locked_until?: string;
  is_locked?: boolean; // Permanent user lock
  last_manual_move_time?: string; // Timestamp for 10-second automation lock
  has_allergens?: boolean;
  allergens?: string[];
  updated_at?: string;
  starters_served_at?: string;
  mains_served_at?: string;
  desserts_served_at?: string;
  seated_at?: string;
  _updateSource?: 'modal' | 'drag' | 'api'; // Temporary flag for update source tracking
}
