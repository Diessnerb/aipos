import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { useQueryClient } from '@tanstack/react-query';
import type { Table } from '@/types/table';
import { offlineAwareDelete } from '@/utils/offlineAwareSupabase';
import { getBoundCompany } from '@/utils/deviceBinding';

/**
 * Hook for table mutations only (create, update, delete)
 * For reading table data, use useTablesQuery instead
 * 
 * This hook invalidates the React Query cache after mutations
 * to trigger refetch in all components using useTablesQuery
 */
export const useTableManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  let authContext;
  
  try {
    authContext = useAuth();
  } catch (error) {
    console.error('AuthProvider not available in useTableManagement:', error);
    return {
      createTable: async () => false,
      updateTable: async () => false,
      updateTableOptimistic: async () => false,
      deleteTable: async () => false,
    };
  }

  const { companyId } = authContext;

  const createTable = async (tableData: Omit<Table, 'id' | 'created_at' | 'company_id'>) => {
    if (!companyId) {
      toast({
        title: "Error",
        description: "No company found",
        variant: "destructive",
      });
      return false;
    }

    try {
      console.log('🔄 Creating table:', { tableData, companyId });

      const insertArgs: any = {
        p_table_number: tableData.table_number,
        p_table_name: tableData.table_name || null,
        p_seats: tableData.seats,
        p_type: tableData.type || null,
        p_shape: tableData.shape || null,
        p_accessibility_friendly: tableData.accessibility_friendly || false,
        p_description: tableData.description || null,
        p_can_combine: tableData.can_combine ?? false,
        p_vip_status: tableData.vip_status || false,
        p_window_seating: tableData.window_seating || false,
        p_privacy_level: tableData.privacy_level || null,
        p_is_high_top: tableData.is_high_top || false,
        p_is_main_dining: tableData.is_main_dining || false,
        p_is_outdoor: tableData.is_outdoor || false,
        p_is_quiet_area: tableData.is_quiet_area || false,
        p_is_family_friendly: tableData.is_family_friendly || false,
        p_is_business_friendly: tableData.is_business_friendly || false,
        p_service_status: tableData.service_status || 'available',
      };
      
      const { data, error } = await (supabase as any).rpc('secure_table_insert_v2', insertArgs);

      if (error) {
        console.error('RPC Error Details:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Table added successfully",
      });

      // Invalidate React Query cache to trigger refetch in all components
      queryClient.invalidateQueries({ queryKey: ['tables', companyId] });

      return true;
    } catch (error: any) {
      console.error('Error creating table:', error);
      
      if (error.message?.includes('idx_tables_number_company') || error.code === '23505') {
        toast({
          title: "Table Number Already Exists",
          description: `Table ${tableData.table_number} already exists. Please choose a different number.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: `Failed to add table: ${error.message}`,
          variant: "destructive",
        });
      }
      return false;
    }
  };

  const updateTable = async (tableId: string, tableData: Partial<Table>, options?: { onOptimizationNeeded?: () => void }) => {
    if (!companyId) {
      toast({
        title: "Error",
        description: "No company found",
        variant: "destructive",
      });
      return false;
    }

    try {
      console.log('🔄 Updating table:', { tableId, tableData, companyId });
      
      // Get current table data from cache for merging
      const currentTables = queryClient.getQueryData<Table[]>(['tables', companyId]) || [];
      const currentTable = currentTables.find(t => t.id === tableId);
      
      if (!currentTable) {
        throw new Error('Table not found');
      }
      
      // Merge current table with incoming data
      const merged = { ...currentTable, ...tableData };
      
      // Detect status changes
      const oldStatus = currentTable.service_status || 'available';
      const newStatus = merged.service_status || 'available';
      const statusChanged = oldStatus !== newStatus;
      
      const updateArgs: any = {
        p_table_id: tableId,
        p_table_number: merged.table_number ?? null,
        p_table_name: merged.table_name ?? null,
        p_seats: merged.seats ?? null,
        p_type: merged.type ?? null,
        p_shape: merged.shape ?? null,
        p_accessibility_friendly: merged.accessibility_friendly ?? null,
        p_description: merged.description ?? null,
        p_can_combine: merged.can_combine ?? null,
        p_vip_status: merged.vip_status ?? null,
        p_window_seating: merged.window_seating ?? null,
        p_privacy_level: merged.privacy_level ?? null,
        p_is_high_top: merged.is_high_top ?? null,
        p_is_main_dining: merged.is_main_dining ?? null,
        p_is_outdoor: merged.is_outdoor ?? null,
        p_is_quiet_area: merged.is_quiet_area ?? null,
        p_is_family_friendly: merged.is_family_friendly ?? null,
        p_is_business_friendly: merged.is_business_friendly ?? null,
        p_service_status: merged.service_status ?? null,
      };

      const { data: response, error } = await (supabase as any).rpc('secure_table_update_v2', updateArgs);

      if (error) throw error;
      
      let success = false;
      let message = "Table updated successfully";
      let responseError = null;

      if (typeof response === 'boolean') {
        success = response;
      } else if (response && typeof response === 'object' && 'success' in response) {
        success = (response as any).success;
        message = (response as any).message || message;
        responseError = (response as any).error;
      } else if (response === true) {
        success = true;
      }

      if (!success) {
        throw new Error(responseError || 'Failed to update table');
      }

      // Handle status change cascades - immediate auto-update
      if (statusChanged && (newStatus === 'out_of_service' || newStatus === 'temporarily_removed')) {
        console.log('⚠️ Service status changed - immediately updating affected reservations...');
        
        const { TableStatusChangeHandler } = await import('@/services/tableStatusChangeHandler');
        
        const impact = await TableStatusChangeHandler.handleStatusChange(
          currentTable.table_number,
          oldStatus,
          newStatus,
          companyId
        );

        // Show result of immediate actions
        if (impact.affectedReservations.length > 0) {
          const variant = impact.unassignedCount > 0 || impact.failedCount > 0 ? "destructive" : "default";
          
          toast({
            title: "Table Out of Service - Reservations Updated",
            description: impact.summary,
            variant,
            duration: 2000,
          });
        } else {
          toast({
            title: "Success",
            description: message,
            duration: 2000,
          });
        }
        
        // Immediately invalidate reservations cache to update timeline
        queryClient.invalidateQueries({ queryKey: ['reservations', companyId] });
      } else {
        toast({
          title: "Success",
          description: message,
          duration: 2000,
        });
      }

      // Trigger optimization callback if provided
      options?.onOptimizationNeeded?.();

      // Invalidate React Query cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['tables', companyId] });

      return true;
    } catch (err: any) {
      console.error('Error updating table:', err);
      const errorMessage = err.message;
      
      if (errorMessage.includes('duplicate key') || errorMessage.includes('idx_tables_number_company')) {
        toast({
          title: "Error",
          description: "A table with this number already exists",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error", 
          description: `Failed to update table: ${errorMessage}`,
          variant: "destructive",
        });
      }
      return false;
    }
  };

  // Lightweight update for service status changes without global loading
  const updateTableOptimistic = async (tableId: string, tableData: Partial<Table>) => {
    try {
      console.log('🔄 Optimistic table update:', { tableId, tableData });
      
      const updateArgs: any = {
        p_table_id: tableId,
        p_table_number: tableData.table_number ?? null,
        p_table_name: tableData.table_name ?? null,
        p_seats: tableData.seats ?? null,
        p_type: tableData.type ?? null,
        p_shape: tableData.shape ?? null,
        p_accessibility_friendly: tableData.accessibility_friendly ?? null,
        p_description: tableData.description ?? null,
        p_can_combine: tableData.can_combine ?? null,
        p_vip_status: tableData.vip_status ?? null,
        p_window_seating: tableData.window_seating ?? null,
        p_privacy_level: tableData.privacy_level ?? null,
        p_is_high_top: tableData.is_high_top ?? null,
        p_is_main_dining: tableData.is_main_dining ?? null,
        p_is_outdoor: tableData.is_outdoor ?? null,
        p_is_quiet_area: tableData.is_quiet_area ?? null,
        p_is_family_friendly: tableData.is_family_friendly ?? null,
        p_is_business_friendly: tableData.is_business_friendly ?? null,
        p_service_status: tableData.service_status ?? null,
      };

      const { data: response, error } = await (supabase as any).rpc('secure_table_update_v2', updateArgs);

      if (error) throw error;
      
      let success = false;
      let responseError = null;

      if (typeof response === 'boolean') {
        success = response;
      } else if (response && typeof response === 'object' && 'success' in response) {
        success = (response as any).success;
        responseError = (response as any).error;
      } else if (response === true) {
        success = true;
      }

      if (!success) {
        throw new Error(responseError || 'Failed to update table');
      }

      // Invalidate cache after optimistic update
      if (companyId) {
        queryClient.invalidateQueries({ queryKey: ['tables', companyId] });
      }

      return true;
    } catch (err: any) {
      console.error('Error in optimistic update:', err);
      throw err;
    }
  };

  const deleteTable = async (tableId: string) => {
    if (!companyId) {
      toast({
        title: "Error",
        description: "No company found",
        variant: "destructive",
      });
      return false;
    }

    try {
      const boundCompany = getBoundCompany();
      
      if (boundCompany) {
        // Use offlineAwareDelete for bound devices (handles offline sync + real DELETE)
        console.log('🔧 Bound device - using offlineAwareDelete for table:', tableId);
        const { error } = await offlineAwareDelete('tables', tableId);
        if (error) throw error;
      } else {
        // Use RPC for authenticated web users
        console.log('🌐 Web user - using secure_table_delete RPC for table:', tableId);
        const { data: success, error } = await supabase.rpc('secure_table_delete', {
          p_table_id: tableId,
          p_company_id: companyId,
        });
        if (error) throw error;
        if (!success) {
          throw new Error('Failed to delete table - table not found or access denied');
        }
      }

      toast({
        title: "Success",
        description: "Table deleted successfully",
      });

      // Directly update cache to remove deleted table (works even with staleTime: Infinity)
      const currentTables = queryClient.getQueryData<Table[]>(['tables', companyId]) || [];
      const filteredTables = currentTables.filter(t => t.id !== tableId);
      queryClient.setQueryData(['tables', companyId], filteredTables);

      return true;
    } catch (err: any) {
      console.error('Error deleting table:', err);
      toast({
        title: "Error",
        description: `Failed to delete table: ${err.message}`,
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    createTable,
    updateTable,
    updateTableOptimistic,
    deleteTable,
  };
};
