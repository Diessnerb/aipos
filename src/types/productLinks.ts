export interface ProductLink {
  id: string;
  menu_item_id: string;
  company_id: string;
  parent_link_id: string | null;
  level: number;
  option_name: string;
  price_modifier: number | null;
  base_price: number | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  children?: ProductLink[];
}

export interface ProductLinkTreeNode extends ProductLink {
  children: ProductLinkTreeNode[];
}

export type PricingMode = 'modifier' | 'base_price';
