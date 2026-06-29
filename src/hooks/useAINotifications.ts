import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AINotificationSettings {
  enabled: boolean;
  showSuccessfulMoves: boolean;
  showOptimizations: boolean;
  showConflictResolutions: boolean;
}

export const useAINotifications = () => {
  const { companyId } = useAuth();
  const [settings, setSettings] = useState<AINotificationSettings>({
    enabled: true,
    showSuccessfulMoves: true,
    showOptimizations: false,
    showConflictResolutions: true
  });

  useEffect(() => {
    if (!companyId || !settings.enabled) return;

    // Listen for assignment history changes (AI moves)
    const assignmentChannel = supabase
      .channel('assignment-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assignment_history',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          const assignment = payload.new;
          
          if (assignment.success && settings.showSuccessfulMoves) {
            toast.success(
              `AI assigned Table ${assignment.assigned_tables?.join(', ') || 'Unknown'}`,
              {
                description: `Strategy: ${assignment.assignment_strategy?.replace(/_/g, ' ') || 'Smart assignment'}`,
                duration: 2000,
              }
            );
          }
        }
      )
      .subscribe();

    // Listen for optimization moves
    const optimizationChannel = supabase
      .channel('optimization-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'optimization_log',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          const optimization = payload.new;
          
          if (settings.showOptimizations) {
            const message = optimization.new_table_number 
              ? `AI moved reservation to Table ${optimization.new_table_number}`
              : 'AI optimised table assignment';
              
            toast.info(message, {
              description: optimization.reason || 'Improved table utilisation',
              duration: 2000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(assignmentChannel);
      supabase.removeChannel(optimizationChannel);
    };
  }, [companyId, settings]);

  const updateSettings = (newSettings: Partial<AINotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const showAIAction = (action: string, details?: string) => {
    if (!settings.enabled) return;

    toast.info(`AI: ${action}`, {
      description: details,
      duration: 2000,
    });
  };

  const showAISuccess = (action: string, details?: string) => {
    if (!settings.enabled || !settings.showSuccessfulMoves) return;

    toast.success(`AI: ${action}`, {
      description: details,
      duration: 2000,
    });
  };

  const showAIOptimization = (details: string) => {
    if (!settings.enabled || !settings.showOptimizations) return;

    toast.info('AI Optimisation Complete', {
      description: details,
      duration: 2000,
    });
  };

  return {
    settings,
    updateSettings,
    showAIAction,
    showAISuccess,
    showAIOptimization
  };
};