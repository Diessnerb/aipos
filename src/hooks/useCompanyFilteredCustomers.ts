
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { getRawPin } from '@/utils/pinAuth';
import { format } from 'date-fns';
import { offlineAwareInsert, offlineAwareUpdate, offlineAwareDelete } from '@/utils/offlineAwareSupabase';

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company_id?: string;
  notes?: string;
  preferences?: string[];
  vip_status?: boolean;
  do_not_contact?: boolean;
  visits?: number;
  total_spent?: number;
  last_visit?: string;
}

interface FilterOptions {
  searchTerm?: string;
  filterStatus?: string;
  todayOnlyFilter?: boolean;
}

export function useCompanyFilteredCustomers(filters: FilterOptions = {}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { companyId, loading: authLoading, pinUser } = useAuth();
  const { searchTerm = '', filterStatus = 'all', todayOnlyFilter = false } = filters;

  const fetchCustomers = useCallback(async () => {
    // Don't fetch if still loading auth or no company ID
    if (authLoading || !companyId) {
      console.log('👥 Skipping customers fetch - authLoading:', authLoading, 'companyId:', companyId);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      console.log('👥 Starting fetchCustomers with companyId:', companyId, 'pinMode:', !!pinUser);

      // Use PIN-based edge function if in PIN mode, otherwise use direct Supabase
      if (pinUser) {
        const rawPin = getRawPin();
        if (!rawPin) {
          throw new Error('PIN authentication expired. Please log in again.');
        }

        const { data: response, error } = await supabase.functions.invoke('pin-customers-fetch', {
          body: { pin: rawPin, companyId }
        });

        if (error) throw error;
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch customers via PIN');
        }

        console.log('👥 PIN-based customers fetch result:', { 
          dataLength: response.data?.length, 
          user: response.user,
          firstCustomer: response.data?.[0]
        });

        setCustomers(response.data || []);
        return;
      }

      // Standard Supabase query for authenticated users
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      console.log('👥 Customers query result:', { 
        dataLength: data?.length, 
        firstCustomer: data?.[0], 
        error: error 
      });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('👥 Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast, companyId, authLoading, pinUser]);

  const createCustomer = useCallback(async (customerData: Omit<Customer, 'id' | 'company_id'>) => {
    if (!companyId) {
      toast({
        title: "Error",
        description: "No company found",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await offlineAwareInsert('customers', { 
        ...customerData, 
        company_id: companyId 
      });

      if (error) throw error;

      await fetchCustomers();
      toast({
        title: "Success",
        description: "Customer created successfully"
      });

      return data;
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error",
        description: "Failed to create customer",
        variant: "destructive"
      });
      throw error;
    }
  }, [fetchCustomers, toast, companyId]);

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    try {
      const { error } = await offlineAwareUpdate('customers', id, updates);

      if (error) throw error;

      await fetchCustomers();
      toast({
        title: "Success",
        description: "Customer updated successfully"
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      toast({
        title: "Error",
        description: "Failed to update customer",
        variant: "destructive"
      });
      throw error;
    }
  }, [fetchCustomers, toast]);

  const deleteCustomer = useCallback(async (id: string) => {
    try {
      const { error } = await offlineAwareDelete('customers', id);

      if (error) throw error;

      await fetchCustomers();
      toast({
        title: "Success",
        description: "Customer deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: "Failed to delete customer",
        variant: "destructive"
      });
      throw error;
    }
  }, [fetchCustomers, toast]);

  // State to hold today's reservation data
  const [todayReservations, setTodayReservations] = useState<{ customer_name: string; email?: string; phone?: string }[]>([]);

  // Fetch today's reservations when todayOnlyFilter changes
  useEffect(() => {
    const fetchTodayReservations = async () => {
      if (!todayOnlyFilter || !companyId) {
        setTodayReservations([]);
        return;
      }

      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const { data, error } = await supabase
          .from('reservations')
          .select('customer_name, email, phone')
          .eq('date', today)
          .eq('company_id', companyId);

        if (error) {
          console.error('Error fetching today\'s reservations:', error);
          setTodayReservations([]);
        } else {
          setTodayReservations(data || []);
        }
      } catch (error) {
        console.error('Error in fetchTodayReservations:', error);
        setTodayReservations([]);
      }
    };

    fetchTodayReservations();
  }, [todayOnlyFilter, companyId]);

  // Apply filtering logic
  const filteredCustomers = useMemo(() => {
    let filtered = customers;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(customer => {
        return customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
               (customer.phone && customer.phone.includes(searchTerm));
      });
    }

    // Apply status filter
    filtered = filtered.filter(customer => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'vip') return customer.vip_status;
      if (filterStatus === 'regular') return (customer.visits || 0) >= 5;
      if (filterStatus === 'new') {
        const lastVisit = customer.last_visit ? new Date(customer.last_visit) : null;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return lastVisit && lastVisit > thirtyDaysAgo;
      }
      if (filterStatus === 'high-value') return (customer.total_spent || 0) > 500;
      if (filterStatus === 'inactive') {
        const lastVisit = customer.last_visit ? new Date(customer.last_visit) : null;
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return !lastVisit || lastVisit < threeMonthsAgo;
      }
      return true;
    });

    // Apply today-only filter
    if (todayOnlyFilter && todayReservations.length > 0) {
      const todayCustomerNames = new Set(todayReservations.map(r => r.customer_name).filter(Boolean));
      const todayCustomerEmails = new Set(todayReservations.map(r => r.email).filter(Boolean));
      const todayCustomerPhones = new Set(todayReservations.map(r => r.phone).filter(Boolean));
      
      filtered = filtered.filter(customer => 
        todayCustomerNames.has(customer.name) || 
        (customer.email && todayCustomerEmails.has(customer.email)) ||
        (customer.phone && todayCustomerPhones.has(customer.phone))
      );
    } else if (todayOnlyFilter && todayReservations.length === 0) {
      // If today filter is on but no reservations today, return empty array
      filtered = [];
    }

    return filtered;
  }, [customers, searchTerm, filterStatus, todayOnlyFilter, todayReservations]);


  useEffect(() => {
    // Only fetch when auth is ready and we have a company ID
    if (!authLoading && companyId) {
      fetchCustomers();
    }
  }, [fetchCustomers, authLoading, companyId]);

  // Real-time subscription for customer changes
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('customer-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('Real-time customer update:', payload);
          fetchCustomers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, fetchCustomers]);

  return {
    customers: filteredCustomers,
    loading,
    fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer
  };
}
