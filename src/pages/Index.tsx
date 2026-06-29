
import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { TypewriterLoading } from '@/components/ui/typewriter-loading';
import { isDeviceBound, getBoundCompany } from '@/utils/deviceBinding';
import { getCurrentPinUser } from '@/utils/pinAuth';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (!loading) {
      const pinUser = getCurrentPinUser();
      if (pinUser) {
        navigate('/reservations?view=timeline');
      } else if (isDeviceBound()) {
        // Check if setup is needed before going to login
        const checkSetup = async () => {
          try {
            const boundCompany = getBoundCompany();
            if (boundCompany) {
              const { data: companyData } = await supabase
                .from('companies')
                .select('setup_completed')
                .eq('id', boundCompany.company_id)
                .single();
              
              if (!companyData?.setup_completed) {
                navigate('/setup-wizard');
                return;
              }
            }
            navigate('/login');
          } catch (error) {
            console.error('Error checking setup status:', error);
            navigate('/login');
          }
        };
        checkSetup();
      } else {
        navigate('/owner-login');
      }
    }
  }, [loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20">
        <div className="flex flex-col items-center space-y-6">
          <TypewriterLoading />
          <div className="text-sm text-muted-foreground">
            <Link to="/super-admin-login">
              <Button variant="ghost" size="sm">
                Super Admin Access
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Index;
