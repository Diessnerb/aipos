import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TableGroup, TableGroupMembership, TableGroupWithTables } from '@/types/table';
import { useAuth } from '@/components/AuthProvider';
import { getBoundCompany } from '@/utils/deviceBinding';
import { useDeviceLiveLayer } from './useDeviceLiveLayer';
import { toast } from 'sonner';

export const useTableGroups = () => {
  const queryClient = useQueryClient();
  const deviceLive = useDeviceLiveLayer();
  const [tableGroups, setTableGroups] = useState<TableGroupWithTables[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { companyId: authCompanyId, loading: authLoading } = useAuth();
  
  // Resolve companyId: prefer auth, fallback to bound company
  const boundCompany = getBoundCompany();
  const companyId = authCompanyId || boundCompany?.company_id;
  
  if (!authCompanyId && boundCompany?.company_id) {
    console.warn('⚠️ useTableGroups: Using bound company fallback for companyId');
  }

  // Helper to map database rows to UI-friendly format
  const mapRow = (row: any): TableGroupWithTables => ({
    ...row,
    // Ensure all required fields are present
    table_numbers: row.table_numbers || [],
    out_of_service_tables: row.out_of_service_tables || [],
  });

  const fetchTableGroups = useCallback(async (opts?: { silent?: boolean; showRetryToast?: boolean; forceRefresh?: boolean }) => {
    const { silent = false, showRetryToast = false, forceRefresh = false } = opts || {};
    if (!companyId) {
      console.log('🚀 useTableGroups: No company_id available');
      return;
    }

    console.log('🚀 useTableGroups: fetchTableGroups called', { 
      company_id: companyId,
      deviceLive,
      silent,
      forceRefresh
    });

    // If device live AND not force refresh, return cached data instantly if available
    if (deviceLive && !forceRefresh) {
      const cached = queryClient.getQueryData<TableGroupWithTables[]>(['table_groups', companyId]);
      if (cached && cached.length > 0) {
        console.log('🚀 useTableGroups: Using cached data', cached.length);
        setTableGroups(cached);
        setLoading(false);
        return;
      }
      console.log('🚀 useTableGroups: No cached data, fetching from database');
    }

    // Force refresh: invalidate cache before fetching
    if (forceRefresh) {
      console.log('🚀 useTableGroups: Force refresh - invalidating cache');
      queryClient.invalidateQueries({ queryKey: ['table_groups', companyId] });
    }

    if (!silent) setLoading(true);
    setError(null);

    try {
      console.log('🚀 useTableGroups: Calling RPC get_table_groups_with_tables');
      const { data, error } = await supabase
        .rpc('get_table_groups_with_tables', { p_company_id: companyId });

      if (error) {
        console.error('🚀 useTableGroups: RPC error', error);
        throw error;
      }

      console.log('🚀 useTableGroups: RPC returned', data?.length, 'groups');
      const mapped = (data || []).map(mapRow);
      setTableGroups(mapped);
      
      // Cache the data for device live
      if (deviceLive) {
        queryClient.setQueryData(['table_groups', companyId], mapped);
      }

      // Verification log after refresh
      if (forceRefresh) {
        mapped.forEach(group => {
          console.log(`✅ Group "${group.group_name}" has ${group.table_numbers?.length || 0} tables:`, group.table_numbers);
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch table groups';
      setError(errorMessage);
      if (showRetryToast) {
        toast.error(errorMessage);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [companyId, deviceLive, queryClient]);

  const createTableGroup = useCallback(async (groupData: Omit<TableGroup, 'id' | 'created_at' | 'updated_at' | 'company_id'>) => {
    if (!companyId) return null;

    // Generate temporary ID for optimistic update
    const tempId = crypto.randomUUID();

    // Create optimistic group object using TableGroupWithTables format
    const optimisticGroup: TableGroupWithTables = {
      group_id: tempId,
      group_name: groupData.group_name,
      description: groupData.description,
      max_combined_capacity: groupData.max_combined_capacity,
      is_active: groupData.is_active,
      display_order: groupData.display_order,
      group_priority: groupData.group_priority,
      advanced_settings: groupData.advanced_settings,
      table_numbers: [],
      out_of_service_tables: [],
      can_combine: false
    };

    // Immediately update local state for instant UI feedback
    setTableGroups(prev => [...prev, optimisticGroup]);

    // Update React Query cache if deviceLive is enabled
    if (deviceLive) {
      queryClient.setQueryData(['table_groups', companyId], (old: TableGroupWithTables[] = []) => {
        return [...old, optimisticGroup];
      });
    }

    try {
      // Convert advanced_settings to JSON for database compatibility
      const dbData = {
        ...groupData,
        company_id: companyId,
        advanced_settings: groupData.advanced_settings as any,
        group_priority: groupData.group_priority || 0
      };

      const { data, error } = await supabase
        .from('table_groups')
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;

      // Fetch the complete group data with tables from RPC
      const { data: rpcData } = await supabase
        .rpc('get_table_groups_with_tables', { p_company_id: companyId });
      
      const realGroup = rpcData?.find((g: any) => g.group_id === data.id);
      
      if (realGroup) {
        const mappedGroup = mapRow(realGroup);
        setTableGroups(prev => prev.map(g => g.group_id === tempId ? mappedGroup : g));

        if (deviceLive) {
          queryClient.setQueryData(['table_groups', companyId], (old: TableGroupWithTables[] = []) => {
            return old.map(g => g.group_id === tempId ? mappedGroup : g);
          });
        }
      }

      toast.success('Table group created successfully');
      return data;
    } catch (err) {
      // Rollback optimistic update on error
      setTableGroups(prev => prev.filter(g => g.group_id !== tempId));

      if (deviceLive) {
        queryClient.setQueryData(['table_groups', companyId], (old: TableGroupWithTables[] = []) => {
          return old.filter(g => g.group_id !== tempId);
        });
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to create table group';
      toast.error(errorMessage);
      throw err;
    }
  }, [companyId, deviceLive, queryClient, mapRow]);

  const updateTableGroup = useCallback(async (groupId: string, groupData: Partial<TableGroup>) => {
    try {
      // Convert advanced_settings to JSON for database compatibility
      const dbData = {
        ...groupData,
        advanced_settings: groupData.advanced_settings as any
      };

      const { error } = await supabase
        .from('table_groups')
        .update(dbData)
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Table group updated successfully');
      await fetchTableGroups({ silent: true, forceRefresh: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update table group';
      toast.error(errorMessage);
      throw err;
    }
  }, [fetchTableGroups]);

  const deleteTableGroup = useCallback(async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('table_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Table group deleted successfully');
      await fetchTableGroups();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete table group';
      toast.error(errorMessage);
      throw err;
    }
  }, [fetchTableGroups]);

  const resequenceGroup = useCallback(async (groupId: string) => {
    try {
      if (!companyId) {
        console.error('No company ID found for resequencing group');
        return;
      }

      await supabase.rpc('resequence_table_group', {
        p_group_id: groupId,
        p_company_id: companyId
      });
    } catch (err) {
      console.error('Failed to resequence group:', err);
    }
  }, [companyId]);

  const addTableToGroup = useCallback(async (tableId: string, groupId: string, priorityOrder?: number) => {
    try {
      let finalPriority = priorityOrder;

      // If priority not provided, calculate the next priority
      if (finalPriority === undefined) {
        const { data: existingMembers, error: queryError } = await supabase
          .from('table_group_memberships')
          .select('priority_order')
          .eq('group_id', groupId)
          .order('priority_order', { ascending: false })
          .limit(1);

        if (queryError) throw queryError;

        // Calculate next priority (max + 1, or 0 if no members)
        finalPriority = existingMembers && existingMembers.length > 0 
          ? (existingMembers[0].priority_order ?? -1) + 1 
          : 0;
      }

      // Upsert with the calculated priority (handles duplicates gracefully)
      const { error } = await supabase
        .from('table_group_memberships')
        .upsert({
          table_id: tableId,
          group_id: groupId,
          priority_order: finalPriority
        }, {
          onConflict: 'table_id,group_id'
        });

      if (error) throw error;

      await fetchTableGroups({ silent: true, forceRefresh: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add table to group';
      console.error('addTableToGroup error:', { tableId, groupId, error: err });
      toast.error(errorMessage);
      throw err;
    }
  }, [fetchTableGroups]);

  const removeTableFromGroup = useCallback(async (tableId: string, groupId: string) => {
    try {
      const { error } = await supabase
        .from('table_group_memberships')
        .delete()
        .eq('table_id', tableId)
        .eq('group_id', groupId);

      if (error) throw error;

      // Resequence the remaining tables in the group
      await resequenceGroup(groupId);

      await fetchTableGroups({ silent: true, forceRefresh: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove table from group';
      toast.error(errorMessage);
      throw err;
    }
  }, [fetchTableGroups, resequenceGroup]);



  // Optimistic updates for group name and capacity
  const updateTableGroupOptimistic = useCallback(async (groupId: string, updates: Partial<TableGroup>, localOnly = false) => {
    if (!companyId) return { success: false, message: 'No company ID found' };

    // Update local state immediately
    setTableGroups(prevGroups => 
      prevGroups.map(group => 
        group.group_id === groupId 
          ? { ...group, ...updates }
          : group
      )
    );

    // If localOnly, don't save to database yet (for real-time typing)
    if (localOnly) return { success: true, message: 'Updated locally' };

    try {
      // Convert advanced_settings to JSON for database compatibility
      const dbUpdates = {
        ...updates,
        advanced_settings: updates.advanced_settings as any
      };

      const { error } = await supabase
        .from('table_groups')
        .update(dbUpdates)
        .eq('id', groupId)
        .eq('company_id', companyId);

      if (error) {
        console.error('Error updating table group:', error);
        // Optionally revert on error - for now just log
        return { success: false, message: 'Failed to save changes' };
      }

      return { success: true, message: 'Changes saved' };
    } catch (error) {
      console.error('Error updating table group:', error);
      return { success: false, message: 'Failed to save changes' };
    }
  }, [companyId]);

  // AI-driven group selection functions
  const getOptimalGroupForPartySize = useCallback((partySize: number) => {
    if (!tableGroups.length) return null;

    // Calculate efficiency for each group that can accommodate the party size
    const viableGroups = tableGroups
      .filter(group => {
        const groupTables = group.table_numbers || [];
        if (groupTables.length === 0) return false;
        
        // Calculate estimated combined capacity
        const totalSeats = groupTables.reduce((sum, tableNum) => {
          // This would need access to tables data - for now use max_combined_capacity
          return sum;
        }, 0);
        
        return group.max_combined_capacity >= partySize;
      })
      .map(group => ({
        ...group,
        efficiency: calculateGroupEfficiency(group.group_id)
      }))
      .sort((a, b) => b.efficiency - a.efficiency); // Highest efficiency first

    return viableGroups.length > 0 ? viableGroups[0] : null;
  }, [tableGroups]);

  const calculateGroupEfficiency = useCallback((groupId: string) => {
    const group = tableGroups.find(g => g.group_id === groupId);
    if (!group || !group.table_numbers?.length) return 0;

    const tableCount = group.table_numbers.length;
    
    if (tableCount === 1) return 100; // Single table is 100% efficient
    
    // Base efficiency calculation (seats retained after combining)
    // This is a simplified version - real implementation would use visual seat data
    const estimatedSeatLoss = Math.min(tableCount - 1, Math.floor(tableCount * 0.15)); // 15% max loss
    const efficiency = Math.max(85, 100 - (estimatedSeatLoss * 5)); // Min 85% efficiency
    
    return efficiency;
  }, [tableGroups]);

  // Add function to update advanced settings
  const updateAdvancedSettings = useCallback(async (groupId: string, advancedSettings: any) => {
    if (!companyId) return { success: false, message: 'No company ID found' };

    try {
      const { error } = await supabase
        .from('table_groups')
        .update({ 
          advanced_settings: advancedSettings as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', groupId)
        .eq('company_id', companyId);

      if (error) throw error;

      toast.success('Advanced settings updated successfully');
      await fetchTableGroups({ silent: true, forceRefresh: true });
      
      return { success: true, message: 'Advanced settings updated' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update advanced settings';
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    }
  }, [companyId, fetchTableGroups]);

  // Add new seat mapping functions
  const saveSeatPositions = useCallback(async (tableId: string, positions: any[]) => {
    if (!companyId) return { success: false, message: 'No company ID found' };

    try {
      const { data, error } = await supabase.rpc('save_table_seat_positions', {
        p_table_id: tableId,
        p_seat_positions: positions,
        p_company_id: companyId
      });

      if (error) throw error;

      const result = data as { success: boolean; message?: string; error?: string };
      if (!result.success) {
        toast.error(result.error || 'Failed to save seat positions');
        return { success: false, message: result.error || 'Failed to save seat positions' };
      }

      toast.success('Seat positions saved successfully');
      return { success: true, message: 'Seat positions saved successfully' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save seat positions';
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    }
  }, [companyId]);

  const loadSeatPositions = useCallback(async (tableId: string) => {
    if (!companyId) return { success: false, message: 'No company ID found', positions: [] };

    try {
      const { data, error } = await supabase.rpc('get_table_seat_positions', {
        p_table_id: tableId,
        p_company_id: companyId
      });

      if (error) throw error;

      const result = data as { success: boolean; seat_positions?: any[]; error?: string };
      if (!result.success) {
        return { success: false, message: result.error || 'Failed to load seat positions', positions: [] };
      }

      return { success: true, message: 'Seat positions loaded', positions: result.seat_positions || [] };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load seat positions';
      return { success: false, message: errorMessage, positions: [] };
    }
  }, [companyId]);

  const calculateGroupCapacity = useCallback(async (groupId: string) => {
    if (!companyId) return { success: false, message: 'No company ID found', scenarios: [] };

    try {
      const { data, error } = await supabase.rpc('calculate_group_capacity_scenarios', {
        p_group_id: groupId,
        p_company_id: companyId
      });

      if (error) throw error;

      const result = data as { success: boolean; scenarios?: any[]; error?: string };
      if (!result.success) {
        return { success: false, message: result.error || 'Failed to calculate capacity', scenarios: [] };
      }

      return { success: true, message: 'Capacity calculated', scenarios: result.scenarios || [] };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate capacity';
      return { success: false, message: errorMessage, scenarios: [] };
    }
  }, [companyId]);

  const saveGroupArrangement = useCallback(async (groupId: string, arrangement: any) => {
    if (!companyId) return { success: false, message: 'No company ID found' };

    try {
      const { data, error } = await supabase.rpc('save_group_arrangement', {
        p_group_id: groupId,
        p_company_id: companyId,
        p_arrangement: arrangement
      });

      if (error) throw error;

      const result = data as { success: boolean; message?: string; error?: string };
      if (!result.success) {
        toast.error(result.error || 'Failed to save arrangement');
        return { success: false, message: result.error || 'Failed to save arrangement' };
      }

      toast.success('Arrangement saved successfully');
      await fetchTableGroups({ silent: true, forceRefresh: true }); // Refresh data silently
      return { success: true, message: 'Arrangement saved successfully' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save arrangement';
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    }
  }, [companyId, fetchTableGroups]);

  // Set up realtime subscription (skip if device live)
  useEffect(() => {
    if (!companyId) return;
    if (deviceLive) {
      console.log('🚀 useTableGroups: Skipping real-time subscription (device live)');
      return;
    }

    const channel = supabase
      .channel('table_groups_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_groups',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('📊 Real-time table group change:', payload);
          
          // Apply incremental updates instead of full refresh
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          if (eventType === 'UPDATE' && newRecord) {
            setTableGroups(prev => prev.map(group => 
              group.group_id === newRecord.id ? mapRow({ ...group, ...newRecord, group_id: newRecord.id }) : group
            ));
          } else if (eventType === 'INSERT' && newRecord) {
            // For new groups, we need the full RPC data, so do a silent refresh
            fetchTableGroups({ silent: true });
          } else if (eventType === 'DELETE' && oldRecord) {
            setTableGroups(prev => prev.filter(group => group.group_id !== oldRecord.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_group_memberships',
          filter: `group_id=in.(${tableGroups.map(g => g.group_id).join(',')})`
        },
        (payload) => {
          console.log('📊 Real-time table group membership change:', payload);
          // For membership changes, do a silent refresh to get updated table numbers
          fetchTableGroups({ silent: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, fetchTableGroups, tableGroups, deviceLive, mapRow]);

  return {
    tableGroups,
    loading,
    error,
    fetchTableGroups,
    createTableGroup,
    updateTableGroup,
    deleteTableGroup,
    addTableToGroup,
    removeTableFromGroup,
    resequenceGroup,
    updateTableGroupOptimistic,
    updateAdvancedSettings,
    // AI-driven selection functions
    getOptimalGroupForPartySize,
    calculateGroupEfficiency,
    // New visual seat mapping functions
    saveSeatPositions,
    loadSeatPositions,
    calculateGroupCapacity,
    saveGroupArrangement
  };
};