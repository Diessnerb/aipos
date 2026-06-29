import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

/**
 * Consistent hook for getting the user's display name
 * Used by Sidebar, Alisha, and other components to ensure consistent name display
 */
export const useDisplayName = () => {
  const { pinUser, user } = useAuth();
  const [displayName, setDisplayName] = useState<string>('User');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDisplayName = async () => {
      try {
        // Priority 1: Get name from database for PIN users
        if (pinUser?.user_id) {
          const { data: userData, error } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', pinUser.user_id)
            .single();

          if (!error && userData?.full_name) {
            setDisplayName(userData.full_name);
            setLoading(false);
            return;
          }
        }

        // Priority 2: Get name from database for authenticated users
        if (user?.id) {
          const { data: userData, error } = await supabase
            .from('users')
            .select('full_name')
            .eq('auth_user_id', user.id)
            .single();

          if (!error && userData?.full_name) {
            setDisplayName(userData.full_name);
            setLoading(false);
            return;
          }
        }

        // Priority 3: Fallback to pinUser.full_name if available
        if (pinUser?.full_name) {
          setDisplayName(pinUser.full_name);
          setLoading(false);
          return;
        }

        // Priority 4: Fallback to user metadata
        if (user?.user_metadata?.full_name) {
          setDisplayName(user.user_metadata.full_name);
          setLoading(false);
          return;
        }

        // Priority 5: Fallback to email username
        if (user?.email) {
          setDisplayName(user.email.split('@')[0]);
          setLoading(false);
          return;
        }

        // Final fallback
        setDisplayName('User');
        setLoading(false);
      } catch (error) {
        console.error('Error fetching display name:', error);
        setDisplayName('User');
        setLoading(false);
      }
    };

    fetchDisplayName();
  }, [pinUser, user]);

  return { displayName, loading };
};
