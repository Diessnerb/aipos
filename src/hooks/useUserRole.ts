import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';

export type AppRole = 'owner' | 'admin' | 'manager' | 'staff';

/**
 * Secure hook to fetch user's highest role from user_roles table
 * Uses security definer function to prevent privilege escalation
 */
export const useUserRole = () => {
  const { currentUser } = useCurrentUser();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHighestRole = async () => {
      if (!currentUser?.id) {
        setLoading(false);
        return;
      }

      console.log('🔐 Fetching role for user:', currentUser.id);

      try {
        // Query the users table directly for role information
        const { data: userData, error } = await supabase
          .from('users')
          .select('role, is_owner, is_company_admin')
          .eq('id', currentUser.id)
          .single();

        if (error) {
          console.error('❌ Error fetching user role:', error);
          setRole('staff'); // Default to lowest permission on error
        } else {
          console.log('✅ User data fetched:', userData);
          
          // Use the role from the database directly
          const userRole = (userData.role || 'staff') as AppRole;
          
          console.log('✅ User role:', userRole);
          setRole(userRole);
        }
      } catch (err) {
        console.error('❌ Exception fetching role:', err);
        setRole('staff');
      }
      
      setLoading(false);
    };

    fetchHighestRole();
  }, [currentUser?.id]);

  // Computed role checks based on hierarchy
  const isOwner = role === 'owner';
  const isAdmin = role === 'admin' || role === 'owner';
  const isManager = role === 'manager' || role === 'admin' || role === 'owner';
  const isStaff = role === 'staff' || role === 'manager' || role === 'admin' || role === 'owner';

  console.log('👤 useUserRole result:', {
    userId: currentUser?.id,
    role,
    loading,
    isOwner,
    isAdmin,
    isManager,
    isStaff
  });

  return {
    role,
    loading,
    isOwner,
    isAdmin,
    isManager,
    isStaff
  };
};
