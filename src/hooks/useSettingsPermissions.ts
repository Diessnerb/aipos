import { usePermissionCheck } from './usePermissionCheck';

export const useSettingsPermissions = () => {
  const { checkPermission, loading } = usePermissionCheck();

  const canAccessIntegrations = () => {
    if (loading) return false;
    
    // Check if user has permission to access settings page
    return checkPermission('/settings', 'view');
  };

  const canAccessSettings = () => {
    if (loading) return false;
    
    // Check if user has permission to access settings page
    return checkPermission('/settings', 'view');
  };

  return {
    canAccessIntegrations: canAccessIntegrations(),
    canAccessSettings: canAccessSettings(),
    isLoading: loading
  };
};