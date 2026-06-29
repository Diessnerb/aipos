import { useState, useCallback } from 'react';
import { PredictiveAssignmentService, PredictiveAssignmentResult } from '@/services/predictiveAssignmentService';
import { useCompanyId } from './useCompanyId';
import { toast } from 'sonner';

export interface UsePredictiveAssignmentResult {
  assignTable: (date: string, time: string, partySize: number, notes?: string) => Promise<PredictiveAssignmentResult | null>;
  optimizeDay: (date: string) => Promise<{ movesSuggested: number; movesExecuted: number; details: string[] } | null>;
  isAssigning: boolean;
  isOptimizing: boolean;
  lastResult: PredictiveAssignmentResult | null;
}

export function usePredictiveAssignment(): UsePredictiveAssignmentResult {
  const [isAssigning, setIsAssigning] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [lastResult, setLastResult] = useState<PredictiveAssignmentResult | null>(null);
  const { companyId: effectiveCompanyId } = useCompanyId();

  const assignTable = useCallback(async (
    date: string,
    time: string, 
    partySize: number,
    notes?: string
  ): Promise<PredictiveAssignmentResult | null> => {
    if (!effectiveCompanyId || isAssigning) return null;

    setIsAssigning(true);
    try {
      const result = await PredictiveAssignmentService.assignBestTableWithPrediction(
        effectiveCompanyId,
        date,
        time,
        partySize,
        notes
      );

      setLastResult(result);

      if (result.success) {
        toast.success(`Table assigned: ${result.assignedTables?.join(', ')}`, {
          description: result.riskAssessment
        });
      } else {
        toast.error('Assignment failed', {
          description: result.message
        });
      }

      return result;
    } catch (error) {
      console.error('Predictive assignment error:', error);
      toast.error('Assignment error', {
        description: 'Failed to assign table with predictive analysis'
      });
      return null;
    } finally {
      setIsAssigning(false);
    }
  }, [effectiveCompanyId, isAssigning]);

  const optimizeDay = useCallback(async (date: string) => {
    if (!effectiveCompanyId || isOptimizing) return null;

    setIsOptimizing(true);
    try {
      const result = await PredictiveAssignmentService.optimizeExistingReservations(
        effectiveCompanyId,
        date
      );

      if (result.movesSuggested > 0) {
        toast.info(`${result.movesSuggested} optimization opportunities found`, {
          description: 'Check the timeline for suggested improvements'
        });
      } else {
        toast.success('Timeline is already optimized', {
          description: 'No beneficial moves detected'
        });
      }

      return result;
    } catch (error) {
      console.error('Day optimization error:', error);
      toast.error('Optimization failed', {
        description: 'Unable to analyze day for improvements'
      });
      return null;
    } finally {
      setIsOptimizing(false);
    }
  }, [effectiveCompanyId, isOptimizing]);

  return {
    assignTable,
    optimizeDay,
    isAssigning,
    isOptimizing,
    lastResult
  };
}