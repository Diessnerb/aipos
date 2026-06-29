import { useAuth } from '@/components/AuthProvider';
import { useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CompanyData {
  recentReservations?: any[];
  upcomingReservations?: any[];
  lowStockItems?: any[];
  vipCustomers?: any[];
  todayStats?: {
    reservationCount: number;
    coverCount: number;
  };
}

interface AIContext {
  userRole: string;
  currentPage: string;
  companyId?: string;
  userId?: string;
  isOwner: boolean;
  taskHistory: string[];
  companyData?: CompanyData;
}

export const useAIContext = () => {
  const { userRole, isOwner, pinUser, user, companyId } = useAuth();
  const location = useLocation();
  const [taskHistory, setTaskHistory] = useState<string[]>([]);
  const [companyData, setCompanyData] = useState<CompanyData>({});

  // Extract page name from route
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    if (path.includes('/reservations')) return 'reservations';
    if (path.includes('/customers')) return 'customers';
    if (path.includes('/inventory')) return 'inventory';
    if (path.includes('/menu')) return 'menu';
    if (path.includes('/staff')) return 'staff';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/settings')) return 'settings';
    if (path.includes('/onboarding')) return 'onboarding';
    return 'other';
  };

  // Fetch company-specific data for AI context
  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!companyId) return;

      const today = new Date().toISOString().split('T')[0];

      try {
        // Fetch recent and upcoming reservations (company-scoped)
        const { data: reservations } = await supabase
          .from('reservations')
          .select('*')
          .eq('company_id', companyId)
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(10);

        // Fetch low stock items (company-scoped)
        // Items where stock is at or below threshold
        const { data: allInventory } = await supabase
          .from('inventory')
          .select('*')
          .eq('company_id', companyId);
        
        const inventory = allInventory?.filter(
          item => item.stock_quantity <= item.threshold
        ).slice(0, 5) || [];

        // Fetch VIP customers (company-scoped)
        const { data: customers } = await supabase
          .from('customers')
          .select('*')
          .eq('company_id', companyId)
          .eq('vip_status', true)
          .limit(10);

        // Calculate today's stats
        const { count: reservationCount } = await supabase
          .from('reservations')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('date', today);

        const { data: todayReservations } = await supabase
          .from('reservations')
          .select('party_size')
          .eq('company_id', companyId)
          .eq('date', today);

        const coverCount = todayReservations?.reduce((sum, r) => sum + (r.party_size || 0), 0) || 0;

        setCompanyData({
          recentReservations: reservations?.slice(0, 5) || [],
          upcomingReservations: reservations || [],
          lowStockItems: inventory || [],
          vipCustomers: customers || [],
          todayStats: {
            reservationCount: reservationCount || 0,
            coverCount,
          },
        });
      } catch (error) {
        console.error('Error fetching company data for AI context:', error);
      }
    };

    fetchCompanyData();
  }, [companyId, location.pathname]);

  const context: AIContext = {
    userRole: userRole || 'staff',
    currentPage: getCurrentPage(),
    companyId: companyId || undefined,
    userId: pinUser?.user_id || user?.id,
    isOwner,
    taskHistory,
    companyData,
  };

  // Track page visits for context
  useEffect(() => {
    const page = getCurrentPage();
    setTaskHistory(prev => {
      const updated = [...prev, `visited_${page}`];
      return updated.slice(-10); // Keep last 10 actions
    });
  }, [location.pathname]);

  const addTaskToHistory = (task: string) => {
    setTaskHistory(prev => {
      const updated = [...prev, task];
      return updated.slice(-10);
    });
  };

  return { context, addTaskToHistory };
};
