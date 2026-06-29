import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

interface SuperAdmin {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export const useSuperAdmin = () => {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [authStateStable, setAuthStateStable] = useState(false);
  const { user } = useAuth();

  // Reset state when authentication changes to prevent stale state
  useEffect(() => {
    if (!user) {
      setIsSuperAdmin(false);
      setSuperAdmins([]);
      setLoading(false);
      setAuthStateStable(false);
    } else {
      setAuthStateStable(true);
    }
  }, [user]);

  useEffect(() => {
    if (user && authStateStable) {
      checkSuperAdminStatus();
    }
  }, [user, authStateStable]);

  // Separate effect for fetching super admins to prevent dependency loop
  useEffect(() => {
    if (isSuperAdmin && authStateStable) {
      fetchSuperAdmins();
    }
  }, [isSuperAdmin, authStateStable]);

  const checkSuperAdminStatus = async () => {
    try {
      // Add session validation before checking super admin status
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc('is_super_admin');
      if (error) {
        console.error('Error checking super admin status:', error);
        setIsSuperAdmin(false);
      } else {
        setIsSuperAdmin(data);
      }
    } catch (error) {
      console.error('Error checking super admin status:', error);
      setIsSuperAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuperAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('super_admins')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching super admins:', error);
      } else {
        setSuperAdmins(data || []);
      }
    } catch (error) {
      console.error('Error fetching super admins:', error);
    }
  };

  const createSuperAdmin = async (email: string, fullName: string, password: string) => {
    try {
      // Use edge function to create super admin without affecting current session
      const { data, error } = await supabase.functions.invoke('create-super-admin', {
        body: { email, fullName, password }
      });

      if (error) {
        console.error('Edge function error:', error);
        return { success: false, error: error.message || 'Failed to create super admin' };
      }

      if (!data.success) {
        return { success: false, error: data.error || 'Failed to create super admin' };
      }

      // Refresh the super admins list
      await fetchSuperAdmins();
      return { success: true };
    } catch (error) {
      console.error('Error creating super admin:', error);
      return { success: false, error };
    }
  };

  const removeSuperAdmin = async (id: string) => {
    try {
      const { error } = await supabase
        .from('super_admins')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchSuperAdmins();
      return { success: true };
    } catch (error) {
      console.error('Error removing super admin:', error);
      return { success: false, error };
    }
  };

  // Function to reset authentication state after critical operations
  const resetAuthState = async () => {
    setLoading(true);
    setAuthStateStable(false);
    
    // Return a proper Promise that resolves when complete
    return new Promise<void>((resolve) => {
      setTimeout(async () => {
        try {
          setAuthStateStable(true);
          await checkSuperAdminStatus();
        } finally {
          resolve();
        }
      }, 500); // Reduced from 1000ms to 500ms
    });
  };

  return {
    isSuperAdmin,
    loading,
    superAdmins,
    createSuperAdmin,
    removeSuperAdmin,
    refetch: fetchSuperAdmins,
    resetAuthState
  };
};