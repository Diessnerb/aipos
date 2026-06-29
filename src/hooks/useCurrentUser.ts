import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

interface CurrentUser {
  id: string;
  role: string;
  is_owner?: boolean;
  is_company_admin?: boolean;
  company_id?: string;
}

export type { CurrentUser };

export const useCurrentUser = () => {
  let authContext;
  
  try {
    authContext = useAuth();
  } catch (error) {
    console.error('AuthProvider not available in useCurrentUser:', error);
    return { currentUser: null, loading: false };
  }
  
  const { pinUser, user, userRole, isOwner } = authContext;
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getCurrentUserData = async () => {
      console.log('useCurrentUser effect triggered:', { pinUser, user, userRole, isOwner });
      
      try {
        if (pinUser) {
          // Fetch additional user details including is_owner
          const { data: userData } = await supabase
            .from('users')
            .select('is_owner, is_company_admin')
            .eq('id', pinUser.user_id)
            .single();

          const currentUserData = {
            id: pinUser.user_id,
            role: pinUser.role,
            company_id: pinUser.company_id,
            is_owner: userData?.is_owner || false,
            is_company_admin: userData?.is_company_admin || false
          };
          console.log('Setting PIN user as currentUser:', currentUserData);
          setCurrentUser(currentUserData);
        } else if (user && userRole) {
          // For authenticated users, fetch their data from users table
          const { data: userData, error } = await supabase
            .from('users')
            .select('id, role, company_id, is_company_admin, is_owner')
            .eq('auth_user_id', user.id)
            .single();

          if (error) {
            console.error('Error fetching current user:', error);
            setCurrentUser(null);
          } else {
            const currentUserData = {
              id: userData.id,
              role: userData.role,
              company_id: userData.company_id,
              is_company_admin: userData.is_company_admin,
              is_owner: userData.is_owner || false
            };
            console.log('Setting auth user as currentUser:', currentUserData);
            setCurrentUser(currentUserData);
          }
        } else {
          console.log('No user data available, setting currentUser to null');
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Error getting current user data:', error);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    getCurrentUserData();
  }, [pinUser, user, userRole, isOwner]);

  return { currentUser, loading };
};