import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Company {
  id: string;
  name: string;
  subdomain: string | null;
  status: string;
  default_admin_email: string | null;
  created_at: string;
  updated_at: string;
  owner_pin?: string;
}

interface CreateCompanyData {
  name: string;
  subdomain: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName: string;
  ownerPin: string;
}

export const useCompanies = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      
      // First try direct table query
      const { data: directData, error: directError } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (directError) {
        console.error('Direct query failed, trying RPC fallback:', directError);
        
        // Fallback to RPC function if direct query fails
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_companies_detailed');
        
        if (rpcError) {
          throw new Error(`Both direct and RPC queries failed: ${rpcError.message}`);
        }
        
        if (rpcData && typeof rpcData === 'object' && 'error' in rpcData) {
          throw new Error(rpcData.error as string);
        }
        
        // Convert RPC format to direct table format for consistency
        const companies = Array.isArray(rpcData) ? rpcData.map((company: any) => ({
          id: company.id,
          name: company.name,
          subdomain: company.subdomain,
          status: company.status,
          default_admin_email: company.default_admin_email,
          default_admin_password: null, // Don't expose password in fallback
          created_at: company.created_at,
          updated_at: company.updated_at
        })) : [];
        
        setCompanies(companies);
      } else {
        setCompanies(directData || []);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: "Error",
        description: "Failed to fetch companies",
        variant: "destructive"
      });
      setCompanies([]); // Set empty array as fallback
    } finally {
      setLoading(false);
    }
  };

  const createCompany = async (companyData: CreateCompanyData) => {
    try {
      console.log('🚀 Starting company creation with data:', companyData);
      
      // Get the current session to ensure we have auth headers
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        const error = 'Not authenticated - please log in as a super admin';
        console.error('❌', error);
        toast({
          title: "Authentication Error",
          description: error,
          variant: "destructive"
        });
        return { success: false, error };
      }

      console.log('📡 About to call Edge Function: create-company-admin with auth');
      
      // Call the Edge Function to handle company creation with admin privileges
      const response = await supabase.functions.invoke('create-company-admin', {
        body: { companyData },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      console.log('📡 Edge Function response:', response);
      const { data, error } = response;

      if (error) {
        console.error('❌ Error calling create-company-admin function:', error);
        console.error('❌ Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
          context: error.context || 'No context'
        });
        toast({
          title: "Error",
          description: `Failed to create company: ${error.message}`,
          variant: "destructive"
        });
        return { success: false, error: error.message };
      }

      console.log('✅ Edge Function returned data:', data);
      
      if (!data || !data.success) {
        console.error('❌ Company creation failed:', data?.error || 'No data returned');
        console.error('❌ Full response data:', data);
        
        // Provide more specific error messages
        let errorMessage = data?.error || "Failed to create company";
        if (errorMessage.includes('subdomain')) {
          errorMessage = "A company with this subdomain already exists. Please choose a different subdomain.";
        } else if (errorMessage.includes('email')) {
          errorMessage = "A company with this admin email already exists.";
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
        return { success: false, error: errorMessage };
      }

      toast({
        title: "Success",
        description: "Company created successfully",
      });
      
      // Add a small delay before refetching to ensure database consistency
      setTimeout(() => {
        fetchCompanies();
      }, 500);
      return { success: true };
    } catch (error) {
      console.error('Error creating company:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Error",
        description: `Failed to create company: ${errorMessage}`,
        variant: "destructive"
      });
      return { success: false, error: errorMessage };
    }
  };

  const updateCompanyStatus = async (companyId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ status })
        .eq('id', companyId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company status updated successfully",
      });
      
      await fetchCompanies();
      return { success: true };
    } catch (error) {
      console.error('Error updating company status:', error);
      toast({
        title: "Error",
        description: "Failed to update company status",
        variant: "destructive"
      });
      return { success: false, error };
    }
  };

  const updateCompanyName = async (companyId: string, newName: string) => {
    try {
      const { data, error } = await supabase.rpc('update_company_name', {
        p_company_id: companyId,
        p_new_name: newName
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to update company name');
      }

      toast({
        title: "Success",
        description: "Company name updated successfully",
      });
      
      await fetchCompanies();
      return { success: true };
    } catch (error) {
      console.error('Error updating company name:', error);
      toast({
        title: "Error",
        description: "Failed to update company name",
        variant: "destructive"
      });
      return { success: false, error };
    }
  };

  const deleteCompany = async (companyId: string) => {
    try {
      // Show immediate feedback that deletion started
      toast({
        title: "Deleting Company",
        description: "Company deletion in progress...",
      });

      // Validate session before deletion
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication Error",
          description: "Session expired - please log in again",
          variant: "destructive"
        });
        return { success: false, error: 'Session expired' };
      }

      const { data, error } = await supabase.rpc('delete_company_super_admin', {
        p_company_id: companyId
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Company deleted successfully",
        });
        return { success: true };
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete company",
          variant: "destructive"
        });
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error deleting company:', error);
      toast({
        title: "Error",
        description: "Failed to delete company",
        variant: "destructive"
      });
      return { success: false, error };
    }
  };

  return {
    companies,
    loading,
    createCompany,
    updateCompanyStatus,
    updateCompanyName,
    deleteCompany,
    refetch: fetchCompanies
  };
};