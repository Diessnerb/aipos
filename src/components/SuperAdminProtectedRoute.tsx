import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { TypewriterLoading } from '@/components/ui/typewriter-loading';
import { supabase } from '@/integrations/supabase/client';

interface SuperAdminProtectedRouteProps {
  children: React.ReactNode;
}

const SuperAdminProtectedRoute: React.FC<SuperAdminProtectedRouteProps> = ({ children }) => {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);

  useEffect(() => {
    // Validate session on mount and on auth state changes
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionValid(!!session);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionValid(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading || sessionValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <TypewriterLoading />
      </div>
    );
  }

  // If no valid session, redirect to login
  if (!sessionValid || !isSuperAdmin) {
    return <Navigate to="/super-admin-login" replace />;
  }

  return <>{children}</>;
};

export default SuperAdminProtectedRoute;