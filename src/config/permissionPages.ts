export interface PermissionPage {
  key: string; // Database page_name
  route: string; // App route
  label: string; // UI display label
  defaults: {
    staff: 'no_access' | 'view' | 'growth' | 'edit' | 'admin';
    manager: 'no_access' | 'view' | 'growth' | 'edit' | 'admin';
    admin: 'no_access' | 'view' | 'growth' | 'edit' | 'admin';
  };
}

export const PERMISSION_PAGES: PermissionPage[] = [
  {
    key: 'reservations',
    route: '/reservations',
    label: 'Reservations',
    defaults: {
      staff: 'growth',
      manager: 'edit',
      admin: 'edit'
    }
  },
  {
    key: 'customers',
    route: '/customers',
    label: 'Customers',
    defaults: {
      staff: 'growth',
      manager: 'edit',
      admin: 'edit'
    }
  },
  {
    key: 'menu_items',
    route: '/menu-items',
    label: 'Menu Items',
    defaults: {
      staff: 'growth',
      manager: 'growth',
      admin: 'edit'
    }
  },
  {
    key: 'pos',
    route: '/pos',
    label: 'POS',
    defaults: {
      staff: 'growth',
      manager: 'edit',
      admin: 'edit'
    }
  },
  {
    key: 'deals',
    route: '/deals',
    label: 'Deals',
    defaults: {
      staff: 'view',
      manager: 'growth',
      admin: 'edit'
    }
  },
  {
    key: 'marketing',
    route: '/marketing',
    label: 'Marketing',
    defaults: {
      staff: 'view',
      manager: 'view',
      admin: 'view'
    }
  },
  {
    key: 'analytics',
    route: '/analytics',
    label: 'Analytics',
    defaults: {
      staff: 'view',
      manager: 'view',
      admin: 'view'
    }
  },
  {
    key: 'delivery',
    route: '/delivery',
    label: 'Delivery Management',
    defaults: {
      staff: 'view',
      manager: 'edit',
      admin: 'edit'
    }
  },
  {
    key: 'delivery_approval',
    route: '/delivery',
    label: 'Approve Delivery Orders',
    defaults: {
      staff: 'no_access',
      manager: 'edit',
      admin: 'edit'
    }
  },
  {
    key: 'suppliers',
    route: '/suppliers',
    label: 'Suppliers',
    defaults: {
      staff: 'view',
      manager: 'edit',
      admin: 'edit'
    }
  },
  {
    key: 'wastage',
    route: '/wastage',
    label: 'Wastage Tracking',
    defaults: {
      staff: 'edit',
      manager: 'edit',
      admin: 'edit'
    }
  },
  {
    key: 'company_settings',
    route: '/settings',
    label: 'Company Settings',
    defaults: {
      staff: 'no_access',
      manager: 'no_access',
      admin: 'no_access'
    }
  }
];

// Helper to build route-to-page map from centralized config
export const buildRouteToPageMap = (): Record<string, string> => {
  const map: Record<string, string> = {};
  
  PERMISSION_PAGES.forEach(page => {
    map[page.route] = page.key;
    
    // Add settings sub-routes all pointing to company_settings
    if (page.key === 'company_settings') {
      map['/settings/company-details'] = page.key;
      map['/settings/team-members'] = page.key;
      map['/settings/branding'] = page.key;
      map['/settings/legal-policy'] = page.key;
      map['/settings/integrations'] = page.key;
      map['/settings/menu'] = page.key;
      map['/settings/access-levels'] = page.key;
      map['/settings/table-assignment'] = page.key;
      // Legacy redirects
      map['/settings/contact-information'] = page.key;
      map['/settings/location-timezone'] = page.key;
    }
    
    // Add menu fallback route
    if (page.key === 'menu_items') {
      map['/menu'] = page.key;
    }
  });
  
  return map;
};