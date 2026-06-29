import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';

export const useOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const oauthSuccess = searchParams.get('oauth_success');
      const service = searchParams.get('service');
      const error = searchParams.get('oauth_error');

      // Handle OAuth error
      if (error) {
        toast({
          title: "Connection Failed",
          description: `Failed to connect to ${service}: ${error}`,
          variant: "destructive",
        });
        
        // Clean up URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        return;
      }

      // Handle OAuth success
      if (oauthSuccess === 'true' && service && user) {
        try {
          // Retrieve stored permissions from localStorage
          const storedPermissions = localStorage.getItem(`pending_permissions_${service}`);
          
          if (storedPermissions) {
            const permissions = JSON.parse(storedPermissions);
            
            // Save permissions to database
            const { error: dbError } = await supabase
              .from('marketing_permissions')
              .upsert({
                company_id: user.id,
                platform: service,
                ...permissions,
                updated_at: new Date().toISOString()
              });

            if (dbError) {
              console.error('Error saving permissions:', dbError);
              throw dbError;
            }

            // Clean up localStorage
            localStorage.removeItem(`pending_permissions_${service}`);

            // Show success toast
            toast({
              title: "Connected Successfully!",
              description: `${service.charAt(0).toUpperCase() + service.slice(1)} has been connected with your selected permissions.`,
            });
          } else {
            // No permissions stored, but still show success
            toast({
              title: "Connected Successfully!",
              description: `${service.charAt(0).toUpperCase() + service.slice(1)} has been connected.`,
            });
          }

          // Clean up URL parameters
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);

        } catch (error) {
          console.error('Error processing OAuth callback:', error);
          toast({
            title: "Error",
            description: "Connected to service but failed to save permissions. Please try reconnecting.",
            variant: "destructive",
          });
          
          // Clean up
          localStorage.removeItem(`pending_permissions_${service}`);
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate, toast, user]);
};
