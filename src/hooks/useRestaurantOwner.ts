import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

export const useRestaurantOwner = () => {
  const { pinUser, user } = useAuth();
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOwnerName = async () => {
      try {
        let companyId: string | null = null;

        // Get company ID from PIN user or authenticated user
        if (pinUser) {
          companyId = pinUser.company_id;
        } else if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('company_id')
            .eq('auth_user_id', user.id)
            .single();
          
          companyId = userData?.company_id;
        }

        if (!companyId) {
          setOwnerName(null);
          setLoading(false);
          return;
        }

        // Fetch the restaurant owner (company admin)
        const { data: ownerData } = await supabase
          .from('users')
          .select('full_name')
          .eq('company_id', companyId)
          .eq('role', 'admin')
          .eq('is_company_admin', true)
          .single();

        setOwnerName(ownerData?.full_name || 'Restaurant Owner');
      } catch (error) {
        console.error('Error fetching restaurant owner:', error);
        setOwnerName('Restaurant Owner');
      } finally {
        setLoading(false);
      }
    };

    fetchOwnerName();
  }, [pinUser, user]);

  return { ownerName, loading };
};