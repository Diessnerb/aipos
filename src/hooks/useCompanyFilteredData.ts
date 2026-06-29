import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompanyId } from './useCompanyId';

/**
 * Generic hook for fetching data filtered by current user's company
 * Ensures complete company isolation for all data operations
 */
export const useCompanyFilteredData = <T extends Record<string, any> = any>(
  tableName: string,
  selectFields: string = '*',
  orderBy?: { column: string; ascending?: boolean }
) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { companyId: effectiveCompanyId } = useCompanyId();

  // Helper function to map database row to consistent format
  const mapRow = useCallback((row: any): T => {
    return {
      ...row,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
    } as T;
  }, []);

  // Backward compatibility: return effective company ID from context
  const getCurrentUserCompanyId = useCallback(async (): Promise<string | null> => {
    return effectiveCompanyId || null;
  }, [effectiveCompanyId]);

  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    if (!effectiveCompanyId) {
      console.warn(`⚠️ ${tableName} - No company ID available`);
      setData([]);
      setError('No company associated with current user');
      if (!options?.silent) {
        setLoading(false);
      }
      return;
    }

    try {
      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);

      let query = supabase
        .from(tableName as any)
        .select(selectFields)
        .eq('company_id', effectiveCompanyId);

      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      }

      const { data: fetchedData, error: fetchError } = await query;

      if (fetchError) {
        console.error(`Error fetching ${tableName}:`, fetchError);
        throw fetchError;
      }

      const mappedData = (fetchedData || []).map(mapRow);
      setData(mappedData);
    } catch (error: any) {
      console.error(`Error in useCompanyFilteredData for ${tableName}:`, error);
      setError(error.message);
      if (!options?.silent) {
        toast({
          title: "Error",
          description: `Failed to fetch ${tableName}`,
          variant: "destructive"
        });
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [tableName, selectFields, effectiveCompanyId, toast, mapRow]);

  const create = useCallback(async (itemData: Omit<T, 'id' | 'created_at' | 'company_id'>) => {
    if (!effectiveCompanyId) {
      throw new Error('No company associated with current user');
    }
    
    try {
      const companyId = effectiveCompanyId;

      // Optimistic update
      const tempId = `temp_${Date.now()}`;
      const optimisticItem = mapRow({
        ...itemData,
        id: tempId,
        company_id: companyId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      
      setData(prevData => [optimisticItem, ...prevData]);

      const { data: newItem, error } = await supabase
        .from(tableName as any)
        .insert([{ ...itemData, company_id: companyId }])
        .select()
        .single();

      if (error) {
        // Rollback optimistic update
        setData(prevData => prevData.filter(item => item.id !== tempId));
        throw error;
      }

      // Replace optimistic item with real data
      const realItem = mapRow(newItem);
      setData(prevData => 
        prevData.map(item => item.id === tempId ? realItem : item)
      );
      
      return realItem;
    } catch (error: any) {
      console.error(`Error creating ${tableName}:`, error);
      toast({
        title: "Error",
        description: `Failed to create ${tableName}`,
        variant: "destructive"
      });
      throw error;
    }
  }, [tableName, effectiveCompanyId, mapRow, toast]);

  const update = useCallback(async (id: string, updates: Partial<T>) => {
    try {
      // Optimistic update
      const originalData = data;
      setData(prevData => 
        prevData.map(item => 
          item.id === id 
            ? { ...item, ...updates, updated_at: new Date().toISOString() }
            : item
        )
      );

      const { error } = await supabase
        .from(tableName as any)
        .update(updates)
        .eq('id', id);

      if (error) {
        // Rollback optimistic update
        setData(originalData);
        throw error;
      }

      // Silent refresh to get the real data
      fetchData({ silent: true });
    } catch (error: any) {
      console.error(`Error updating ${tableName}:`, error);
      toast({
        title: "Error",
        description: `Failed to update ${tableName}`,
        variant: "destructive"
      });
      throw error;
    }
  }, [tableName, data, fetchData, toast]);

  const deleteItem = useCallback(async (id: string) => {
    try {
      // Optimistic update
      const originalData = data;
      setData(prevData => prevData.filter(item => item.id !== id));

      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq('id', id);

      if (error) {
        // Rollback optimistic update
        setData(originalData);
        throw error;
      }
    } catch (error: any) {
      console.error(`Error deleting ${tableName}:`, error);
      toast({
        title: "Error",
        description: `Failed to delete ${tableName}`,
        variant: "destructive"
      });
      // Rollback optimistic update on error
      setData(data);
      throw error;
    }
  }, [tableName, data, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription for data updates
  useEffect(() => {
    if (!effectiveCompanyId) return;

    const channel = supabase
      .channel(`${tableName}-updates-${effectiveCompanyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `company_id=eq.${effectiveCompanyId}`
        },
          (payload) => {
            console.log(`Real-time ${tableName} update:`, payload);
            
            // Handle different events with incremental updates
            if (payload.eventType === 'INSERT' && payload.new) {
              const newItem = mapRow(payload.new);
              setData(prevData => {
                const existingIndex = prevData.findIndex(item => item.id === newItem.id);
                if (existingIndex === -1) {
                  return [newItem, ...prevData];
                }
                return prevData;
              });
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              const updatedItem = mapRow(payload.new);
              setData(prevData => 
                prevData.map(item => 
                  item.id === updatedItem.id ? updatedItem : item
                )
              );
            } else if (payload.eventType === 'DELETE' && payload.old) {
              setData(prevData => 
                prevData.filter(item => item.id !== payload.old.id)
              );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName, effectiveCompanyId, mapRow]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    create,
    update,
    deleteItem,
    getCurrentUserCompanyId
  };
};