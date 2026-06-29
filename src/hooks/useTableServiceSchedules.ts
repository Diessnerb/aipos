import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { TableRequiringAttention } from "@/types/table";
import { toast } from "@/hooks/use-toast";

export const useTableServiceSchedules = () => {
  const [tablesRequiringAttention, setTablesRequiringAttention] = useState<TableRequiringAttention[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, companyId } = useAuth();

  const fetchTablesRequiringAttention = async () => {
    if (!companyId) {
      setTablesRequiringAttention([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('get_tables_requiring_attention', { p_company_id: companyId });

      if (error) throw error;
      
      setTablesRequiringAttention(data || []);
    } catch (error) {
      console.error('Error fetching tables requiring attention:', error);
      toast({
        title: "Error",
        description: "Failed to load service notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createServiceSchedule = async (tableId: string, durationDays: number | null) => {
    try {
      const { data, error } = await supabase
        .rpc('create_service_schedule', {
          p_table_id: tableId,
          p_duration_days: durationDays,
        });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create service schedule');
      }

      toast({
        title: "Schedule Created",
        description: durationDays 
          ? `Table will be out of service for ${durationDays} ${durationDays === 1 ? 'day' : 'days'}`
          : "Table set to out of service (undetermined duration)",
      });

      return true;
    } catch (error) {
      console.error('Error creating service schedule:', error);
      toast({
        title: "Error",
        description: "Failed to create service schedule",
        variant: "destructive",
      });
      return false;
    }
  };

  const resolveServiceSchedule = async (
    scheduleId: string,
    action: 'turn_on' | 'extend' | 'dismiss',
    extendDays?: number
  ) => {
    try {
      const { data, error } = await supabase
        .rpc('resolve_service_schedule', {
          p_schedule_id: scheduleId,
          p_action: action,
          p_extend_days: extendDays || null,
        });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to resolve service schedule');
      }

      const messages = {
        turn_on: 'Table turned back on',
        extend: `Service period extended by ${extendDays} ${extendDays === 1 ? 'day' : 'days'}`,
        dismiss: 'Notification dismissed',
      };

      toast({
        title: "Success",
        description: messages[action],
      });

      // Refresh the list
      await fetchTablesRequiringAttention();

      return true;
    } catch (error) {
      console.error('Error resolving service schedule:', error);
      toast({
        title: "Error",
        description: "Failed to update service schedule",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchTablesRequiringAttention();

    // Set up realtime subscription
    if (!companyId) return;

    const channel = supabase
      .channel('service-schedules-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_service_schedules',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchTablesRequiringAttention();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  return {
    tablesRequiringAttention,
    loading,
    createServiceSchedule,
    resolveServiceSchedule,
    refetch: fetchTablesRequiringAttention,
  };
};
