export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category_id: string | null;
  tags: string[] | null;
  allergens: string[] | null;
  card_color: string | null;
  display_order?: number;
  is_active?: boolean;
  company_id?: string;
  created_at?: string;
  updated_at?: string;
  image_urls?: string[];
  external_pos_id?: string;
  pos_metadata?: any;
  pos_sync_status?: string;
  last_pos_sync?: string;
  sync_conflicts?: any;
  category_type?: 'drinks' | 'starters' | 'mains' | 'desserts';
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  company_id: string;
  card_color?: string | null;
  category_type?: 'drinks' | 'starters' | 'mains' | 'desserts';
  subcategories?: MenuCategory[];
}