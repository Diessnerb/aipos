import { useMemo } from 'react';
import { usePagePermissions } from './usePagePermissions';
import { useAuth } from '@/components/AuthProvider';
import { buildRouteToPageMap } from '@/config/permissionPages';

// Normalize page names to handle case sensitivity and format differences
const normalizePage = (pageName: string): string => {
  return pageName.toLowerCase().replace(/[\s-]/g, '_');
};

// Map routes to page names using centralized configuration
const routeToPageMap: Record<string, string> = buildRouteToPageMap();

// Define permission hierarchy
const permissionHierarchy = {
  'no_access': 0,
  'view': 1,
  'growth': 2,
  'edit': 3,
  'admin': 4
};

export const usePermissionCheck = () => {
  const { permissions, loading, isOwner } = usePagePermissions();
  const { pinUser, userRole } = useAuth();

  const checkPermission = useMemo(() => {
    return (route: string, requiredLevel: 'view' | 'growth' | 'edit' | 'admin' = 'view') => {
      // Debug logging for owner check
      console.log('🔍 Permission Check Debug:', {
        route,
        requiredLevel,
        isOwner,
        loading,
        permissions: permissions.length,
        userRole,
        pinUserRole: pinUser?.role // Role from user_roles table
      });
      
      // CRITICAL: Owners bypass ALL permission checks - highest privilege
      // Role comes from secure user_roles table, checked via security definer function
      if (isOwner === true) {
        console.log('✅ Owner bypass activated (role from user_roles table) for route:', route);
        return true;
      }
      
      // If still loading permissions, default to false for non-owners
      if (loading) {
        console.log('⏳ Loading permissions, denying access for route:', route);
        return false;
      }
      
      // Get the page name from the route (handle route prefixes)
      let pageName = routeToPageMap[route];
      if (!pageName && route.startsWith('/settings')) {
        pageName = 'company_settings';
      }
      if (!pageName) {
        console.log('❌ Unknown route:', route);
        return false; // Unknown route, deny access
      }
      
      // Map userRole to access_level for permission lookup
      let accessLevel: 'staff' | 'manager' | 'admin';
      if (userRole === 'admin') {
        accessLevel = 'admin';
      } else if (userRole === 'manager') {
        accessLevel = 'manager';
      } else {
        accessLevel = 'staff';
      }
      
      // Find permission for this page AND user's access level (with normalization)
      const normalizedPageName = normalizePage(pageName);
      const pagePermission = permissions.find(p => 
        normalizePage(p.page_name) === normalizedPageName && p.access_level === accessLevel
      );
      
      console.log('🔍 Permission lookup:', {
        pageName,
        userRole,
        accessLevel,
        pagePermission,
        allPermissions: permissions.filter(p => p.page_name === pageName)
      });
      
      if (!pagePermission) {
        console.log('❌ No permission found for:', { pageName, accessLevel });
        return false; // No permission set for this role, deny access
      }
      
      // Check if user's permission level meets the requirement
      const userLevel = permissionHierarchy[pagePermission.permission_type];
      const requiredLevelValue = permissionHierarchy[requiredLevel];
      
      const hasAccess = userLevel >= requiredLevelValue;
      console.log('🔍 Permission calculation:', {
        userPermissionType: pagePermission.permission_type,
        userLevel,
        requiredLevel,
        requiredLevelValue,
        hasAccess
      });
      
      return hasAccess;
    };
  }, [permissions, loading, isOwner, userRole]);

  return {
    checkPermission,
    loading,
    isOwner
  };
};