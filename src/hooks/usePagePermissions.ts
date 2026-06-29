import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useQueryClient } from '@tanstack/react-query';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { PERMISSION_PAGES } from '@/config/permissionPages';

export interface PagePermission {
  id: string;
  page_name: string;
  access_level: 'staff' | 'manager' | 'admin';
  permission_type: 'no_access' | 'view' | 'growth' | 'edit' | 'admin';
  company_id: string;
  created_at: string;
  updated_at: string;
}

export const usePagePermissions = () => {
  const [permissions, setPermissions] = useState<PagePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, pinUser, companyId } = useAuth();
  const queryClient = useQueryClient();
  const deviceLive = useDeviceLiveLayer();

  // Get current user's company_id - use companyId from auth context for PIN users
  const userCompanyId = companyId;

  // Debug logging
  console.log('usePagePermissions Debug:', {
    user: user?.id || null,
    pinUser: pinUser?.user_id || null,
    companyId,
    userCompanyId
  });

  const fetchPermissions = useCallback(async () => {
    // If device is live, get instant data from cache
    if (deviceLive && userCompanyId) {
      const cachedPermissions = queryClient.getQueryData<PagePermission[]>(['page_permissions', userCompanyId]);
      if (cachedPermissions) {
        console.log('📋 Using cached page permissions from device layer:', cachedPermissions.length);
        setPermissions(cachedPermissions);
        setLoading(false);
        return;
      }
    }

    if (!userCompanyId) {
      console.log('No company ID available for permissions fetch', { userCompanyId });
      setLoading(false);
      setPermissions([]);
      return;
    }

    console.log('Fetching permissions for company:', userCompanyId);
    setLoading(true);
    
    try {
      let data;
      let error;

      // Use the security definer function to bypass RLS for PIN users
      if (pinUser) {
        console.log('Fetching permissions via RPC for PIN user');
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_page_permissions_by_company', {
          company_uuid: userCompanyId
        });
        data = rpcData;
        error = rpcError;
      } else {
        console.log('Fetching permissions via direct query for authenticated user');
        // For authenticated users, use direct query with RLS
        const { data: directData, error: directError } = await supabase
          .from('page_permissions')
          .select('id, page_name, access_level, permission_type, company_id, created_at, updated_at')
          .eq('company_id', userCompanyId)
          .order('page_name', { ascending: true });
        data = directData;
        error = directError;
      }

      if (error) throw error;
      
      // If no permissions found in database, fall back to defaults from config
      if (!data || data.length === 0) {
        console.log('No permissions in database, using defaults from config');
        const defaultPermissions: PagePermission[] = PERMISSION_PAGES.map(page => ({
          id: `default-${page.key}`,
          page_name: page.key,
          access_level: 'staff' as const,
          permission_type: page.defaults.staff,
          company_id: userCompanyId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        setPermissions(defaultPermissions);
      } else {
        console.log('Permissions fetched successfully:', data);
        setPermissions(data || []);
      }
    } catch (error) {
      console.error('Error fetching page permissions:', error);
      // On error, also fall back to defaults
      const defaultPermissions: PagePermission[] = PERMISSION_PAGES.map(page => ({
        id: `default-${page.key}`,
        page_name: page.key,
        access_level: 'staff' as const,
        permission_type: page.defaults.staff,
        company_id: userCompanyId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      setPermissions(defaultPermissions);
    } finally {
      setLoading(false);
    }
  }, [userCompanyId, pinUser]);

  const updatePermission = useCallback(async (id: string, permission_type: 'no_access' | 'view' | 'growth' | 'edit' | 'admin') => {
    try {
      // Optimistic update for better UX
      setPermissions(prev => 
        prev.map(p => p.id === id ? { ...p, permission_type, updated_at: new Date().toISOString() } : p)
      );

      const { error } = await supabase
        .from('page_permissions')
        .update({ permission_type })
        .eq('id', id);

      if (error) {
        // Revert optimistic update on error
        await fetchPermissions();
        throw error;
      }
      
      // Force refetch after short delay to ensure sync
      setTimeout(() => {
        fetchPermissions();
      }, 300);
    } catch (error) {
      console.error('Error updating permission:', error);
      throw error;
    }
  }, [fetchPermissions]);

  const addPermission = useCallback(async (page_name: string, access_level: 'staff' | 'manager' | 'admin', permission_type: 'no_access' | 'view' | 'growth' | 'edit' | 'admin') => {
    if (!userCompanyId) return;
    
    try {
      const { data, error } = await supabase
        .from('page_permissions')
        .insert({ 
          page_name, 
          access_level, 
          permission_type,
          company_id: userCompanyId 
        })
        .select()
        .single();

      if (error) throw error;
      
      // Add to local state immediately (optimistic update)
      if (data) {
        setPermissions(prev => [...prev, data].sort((a, b) => a.page_name.localeCompare(b.page_name)));
        
        // Force a refetch after a short delay to ensure we have the latest data
        // This handles any race conditions with realtime subscriptions
        setTimeout(() => {
          fetchPermissions();
        }, 300);
      }
    } catch (error) {
      console.error('Error adding permission:', error);
      // Refetch to ensure UI is in sync with database
      await fetchPermissions();
      throw error;
    }
  }, [userCompanyId, fetchPermissions]);

  const deletePermission = useCallback(async (id: string) => {
    try {
      // Optimistic update
      setPermissions(prev => prev.filter(p => p.id !== id));

      const { error } = await supabase
        .from('page_permissions')
        .delete()
        .eq('id', id);

      if (error) {
        // Revert optimistic update on error
        await fetchPermissions();
        throw error;
      }
    } catch (error) {
      console.error('Error deleting permission:', error);
      throw error;
    }
  }, [fetchPermissions]);

  useEffect(() => {
    fetchPermissions();

    // Skip realtime subscriptions if device is live (handled by DeviceDataManager)
    if (deviceLive) {
      console.log('📋 Skipping permissions realtime subscription - device layer is active');
      return;
    }

    // Set up realtime subscription for instant permission updates
    if (userCompanyId) {
      console.log('Setting up realtime subscription for permissions');
      let refetchTimeout: NodeJS.Timeout | null = null;
      
      const channel = supabase
        .channel('page_permissions_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'page_permissions',
            filter: `company_id=eq.${userCompanyId}`
          },
          () => {
            console.log('Page permissions changed via realtime, scheduling refetch...');
            // Debounce refetches to avoid overwriting optimistic updates
            if (refetchTimeout) clearTimeout(refetchTimeout);
            refetchTimeout = setTimeout(() => {
              fetchPermissions();
            }, 500);
          }
        )
        .subscribe();

      return () => {
        console.log('Cleaning up realtime subscription');
        if (refetchTimeout) clearTimeout(refetchTimeout);
        supabase.removeChannel(channel);
      };
    }
  }, [fetchPermissions, userCompanyId, deviceLive]);

  // Check if user is owner - owners bypass all permission restrictions
  // Role now comes from secure user_roles table
  const isOwner = pinUser?.is_owner === true || pinUser?.role === 'owner';
  
  // Debug owner status
  console.log('👤 Owner Status Debug:', {
    pinUser: pinUser ? {
      user_id: pinUser.user_id,
      email: pinUser.email,
      is_owner: pinUser.is_owner,
      role: pinUser.role // From user_roles table via RPC
    } : null,
    isOwner,
    isOwnerCheck1: pinUser?.is_owner === true,
    isOwnerCheck2: pinUser?.role === 'owner',
    companyId: userCompanyId
  });

  // Memoize return object to prevent unnecessary re-renders
  // Owner bypass: never show loading for owners
  return useMemo(() => ({
    permissions: permissions,
    loading: isOwner ? false : (loading || !userCompanyId),
    updatePermission,
    addPermission,
    deletePermission,
    refetch: fetchPermissions,
    isOwner
  }), [permissions, loading, userCompanyId, updatePermission, addPermission, deletePermission, fetchPermissions, isOwner]);
};