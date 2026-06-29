import React from 'react';
import {
  CalendarRange,
  Users,
  Menu,
  Percent,
  TrendingUp,
  BarChart3,
  ShoppingCart,
  ChefHat,
  Receipt,
  LucideIcon,
  Truck,
  Trash2,
  Package,
} from 'lucide-react';

export interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

// Shared navigation items for consistent sidebar display across all views
export const navigationItems: NavigationItem[] = [
  { title: 'Reservations', url: '/reservations', icon: CalendarRange },
  { title: 'Customers', url: '/customers', icon: Users },
  { title: 'Menu', url: '/menu-items', icon: Menu },
  { title: 'POS', url: '/pos', icon: ShoppingCart },
  { title: 'Kitchen', url: '/kitchen', icon: ChefHat },
  { title: 'Orders', url: '/orders', icon: Receipt },
  { title: 'Deals', url: '/deals', icon: Percent },
  { title: 'Marketing', url: '/marketing', icon: TrendingUp },
  { title: 'Analytics', url: '/analytics', icon: BarChart3 },
  { title: 'Delivery', url: '/delivery', icon: Package },
  { title: 'Suppliers', url: '/suppliers', icon: Truck },
  { title: 'Wastage', url: '/wastage', icon: Trash2 },
];