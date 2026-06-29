// Environment-based route configuration
const isDevelopment = import.meta.env.DEV;

// Core production-ready pages - always included
export const CORE_ROUTES = {
  // Authentication & Landing
  INDEX: '/',
  LOGIN: '/login',
  OWNER_LOGIN: '/owner-login',
  SUPER_ADMIN_LOGIN: '/super-admin-login',
  SUPER_ADMIN: '/super-admin',
  
  // Core Business Functions
  RESERVATIONS: '/reservations',
  CUSTOMERS: '/customers',
  MENU_ITEMS: '/menu-items',
  POS: '/pos',
  KITCHEN: '/kitchen',
  ORDERS: '/orders',
  DEALS: '/deals',
  MARKETING: '/marketing',
  ANALYTICS: '/analytics',
  
  // Settings (all sub-pages)
  SETTINGS: '/settings',
  SETTINGS_COMPANY_DETAILS: '/settings/company-details',
  SETTINGS_TEAM_MEMBERS: '/settings/team-members',
  SETTINGS_BRANDING: '/settings/branding',
  SETTINGS_LEGAL_POLICY: '/settings/legal-policy',
  SETTINGS_INTEGRATIONS: '/settings/integrations',
  SETTINGS_MENU: '/settings/menu',
  SETTINGS_ACCESS_LEVELS: '/settings/access-levels',
  SETTINGS_TABLE_ASSIGNMENT: '/settings/table-assignment',
  SETTINGS_OPENING_HOURS: '/settings/opening-hours',
  SETTINGS_DEVICE: '/settings/device',
  
  // Legal Pages
  PRIVACY_POLICY: '/privacy-policy',
  TERMS_OF_SERVICE: '/terms-of-service',
} as const;

  // Development/experimental pages - only in dev environment
export const DEV_ROUTES = {
  // Legacy/Development Pages
  MENU_MANAGER: '/menu',
  KITCHEN_VIEW: '/kitchen-view',
  INVENTORY: '/inventory',
  ORDER_REVIEW: '/order-review',
  INVOICES: '/invoices',
  LOCATIONS: '/locations',
  ROTAS: '/rotas',
  HOLIDAY_REQUESTS: '/holiday-requests',
  PAST_ORDERS: '/past-orders',
  POS_ORDERS: '/pos-orders',
} as const;

// Helper to check if dev routes should be included
export const shouldIncludeDevRoutes = () => isDevelopment;

// Combined routes based on environment
export const getAvailableRoutes = () => {
  const routes = { ...CORE_ROUTES };
  
  if (shouldIncludeDevRoutes()) {
    return { ...routes, ...DEV_ROUTES };
  }
  
  return routes;
};