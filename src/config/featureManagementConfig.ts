import { 
  CalendarRange, 
  Users, 
  Menu, 
  ShoppingCart, 
  ChefHat, 
  Receipt, 
  Percent, 
  TrendingUp, 
  BarChart3, 
  Package, 
  Truck, 
  Trash2,
  Settings,
  LucideIcon 
} from 'lucide-react';

export interface FeatureToggle {
  key: string;
  label: string;
  description: string;
  source: 'settings' | 'features';
  defaultValue?: boolean;
}

export interface FeatureSection {
  id: string;
  name: string;
  icon: LucideIcon;
  pageFeature: string;
  description: string;
  automations?: FeatureToggle[];
  features?: FeatureToggle[];
  advancedSettings?: Array<{
    key: string;
    label: string;
    type: 'select' | 'number' | 'time-range';
    options?: Array<{ value: string; label: string }>;
    source: 'settings';
  }>;
}

export const featureSections: FeatureSection[] = [
  {
    id: 'reservations',
    name: 'Reservations',
    icon: CalendarRange,
    pageFeature: 'reservations',
    description: 'Manage table bookings and reservations system',
    automations: [
      { 
        key: 'auto_assign_tables', 
        label: 'Auto-assign Tables', 
        description: 'Automatically assign tables to new reservations',
        source: 'settings',
        defaultValue: true
      },
      { 
        key: 'optimization_enabled', 
        label: 'Smart Optimization', 
        description: 'Intelligent table allocation based on party size',
        source: 'settings',
        defaultValue: true
      },
      { 
        key: 'strategic_optimization_enabled', 
        label: 'Strategic Optimization', 
        description: 'Advanced optimization during quiet hours',
        source: 'settings',
        defaultValue: true
      },
      { 
        key: 'sms_reminders_enabled', 
        label: 'SMS Reminders', 
        description: 'Send SMS reminders to customers',
        source: 'settings',
        defaultValue: false
      },
      { 
        key: 'enable_time_based_group_protection', 
        label: 'Time-Based Group Protection', 
        description: 'Protect table groups during peak hours',
        source: 'settings',
        defaultValue: false
      },
    ],
    advancedSettings: [
      {
        key: 'optimization_mode',
        label: 'Optimization Mode',
        type: 'select',
        options: [
          { value: 'continuous', label: 'Continuous' },
          { value: 'scheduled', label: 'Scheduled' },
          { value: 'manual', label: 'Manual' }
        ],
        source: 'settings'
      }
    ]
  },
  {
    id: 'customers',
    name: 'Customers',
    icon: Users,
    pageFeature: 'customers',
    description: 'Customer database and loyalty management',
    features: []
  },
  {
    id: 'menu',
    name: 'Menu',
    icon: Menu,
    pageFeature: 'menu',
    description: 'Menu items and ingredient management',
    features: [
      { 
        key: 'show_allergen_disclaimer', 
        label: 'Allergen Disclaimer', 
        description: 'Display allergen warnings on menus',
        source: 'settings',
        defaultValue: true
      }
    ]
  },
  {
    id: 'pos',
    name: 'POS',
    icon: ShoppingCart,
    pageFeature: 'pos',
    description: 'Point of Sale system for order taking',
    features: []
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    icon: ChefHat,
    pageFeature: 'kitchen',
    description: 'Kitchen display system for order management',
    features: []
  },
  {
    id: 'orders',
    name: 'Orders',
    icon: Receipt,
    pageFeature: 'orders',
    description: 'Order history and management',
    features: []
  },
  {
    id: 'deals',
    name: 'Deals',
    icon: Percent,
    pageFeature: 'deals',
    description: 'Promotional deals and discount management',
    features: []
  },
  {
    id: 'marketing',
    name: 'Marketing',
    icon: TrendingUp,
    pageFeature: 'marketing',
    description: 'Marketing campaigns and customer engagement',
    features: []
  },
  {
    id: 'analytics',
    name: 'Analytics',
    icon: BarChart3,
    pageFeature: 'analytics',
    description: 'Business insights and reporting',
    features: []
  },
  {
    id: 'delivery',
    name: 'Delivery',
    icon: Package,
    pageFeature: 'delivery',
    description: 'Delivery order and stock management',
    automations: [
      { 
        key: 'enable_auto_ordering', 
        label: 'Auto-generate Orders', 
        description: 'Automatically create orders based on stock levels',
        source: 'settings',
        defaultValue: false
      },
      { 
        key: 'notify_on_low_stock', 
        label: 'Low Stock Notifications', 
        description: 'Alert when ingredients run low',
        source: 'settings',
        defaultValue: true
      },
      { 
        key: 'notify_on_order_received', 
        label: 'Order Receipt Notifications', 
        description: 'Notify when deliveries are received',
        source: 'settings',
        defaultValue: true
      }
    ]
  },
  {
    id: 'suppliers',
    name: 'Suppliers',
    icon: Truck,
    pageFeature: 'suppliers',
    description: 'Supplier database and order management',
    features: []
  },
  {
    id: 'wastage',
    name: 'Wastage',
    icon: Trash2,
    pageFeature: 'wastage',
    description: 'Food waste tracking and cost analysis',
    features: []
  },
  {
    id: 'system',
    name: 'System Settings',
    icon: Settings,
    pageFeature: 'system',
    description: 'Global system configuration',
    advancedSettings: [
      {
        key: 'pin_idle_timeout_seconds',
        label: 'PIN Session Timeout (seconds)',
        type: 'number',
        source: 'settings'
      }
    ]
  }
];
