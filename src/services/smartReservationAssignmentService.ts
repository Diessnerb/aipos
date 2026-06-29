import { supabase } from '@/integrations/supabase/client';
import { SmartAutoAssignmentService, AutoAssignmentResult } from './smartAutoAssignmentService';
import { ReservationConflictService } from './reservationConflictService';
import { CapacityLogicService } from './capacityLogicService';
import { toast } from 'sonner';

/**
 * Enhanced Smart Reservation Assignment Service
 * Integrates auto-assignment with reservation optimization and conflict resolution
 */
export class SmartReservationAssignmentService {
  
  /**
   * Comprehensive table assignment that can optimize existing reservations
   * This is the main method that should be called from the Create Reservation modal
   */
  static async assignOptimalTables(
    companyId: string,
    date: string,
    time: string,
    partySize: number,
    notes?: string
  ): Promise<AutoAssignmentResult & { 
    optimizationApplied?: boolean;
    movedReservations?: number;
  }> {
    console.log(`🎯 [OPTIMAL-ASSIGN] Starting comprehensive assignment for party of ${partySize}`);
    
    try {
      // Step 1: Try standard smart assignment first (now includes partial logic)
      console.log(`📋 [OPTIMAL-ASSIGN] Attempting smart assignment with partial table logic...`);
      const standardResult = await SmartAutoAssignmentService.assignBestTable(
        companyId, date, time, partySize, notes
      );

      if (standardResult.success) {
        console.log(`✅ [OPTIMAL-ASSIGN] Standard assignment successful:`, standardResult);
        return {
          ...standardResult,
          optimizationApplied: false,
          movedReservations: 0
        };
      }

      console.log(`❌ [OPTIMAL-ASSIGN] Standard assignment failed, trying optimization...`);

      // Step 2: If standard assignment fails, try with optimization
      const optimizationResult = await this.tryAssignmentWithOptimization(
        companyId, date, time, partySize, notes
      );

      if (optimizationResult.success) {
        console.log(`✅ [OPTIMAL-ASSIGN] Optimization-assisted assignment successful:`, optimizationResult);
        return optimizationResult;
      }

      console.log(`❌ [OPTIMAL-ASSIGN] All assignment strategies failed`);
      
      // Step 3: Get smart suggestions for alternative times/tables
      const suggestions = await SmartAutoAssignmentService.getSmartSuggestions(
        companyId, partySize, date, time
      );

      return {
        success: false,
        message: 'No suitable tables available even with optimization',
        alternativeTimes: suggestions,
        conflictsDetected: true,
        conflictResolution: 'Try different time slots or manually assign tables'
      };

    } catch (error) {
      console.error('❌ [OPTIMAL-ASSIGN] Comprehensive assignment error:', error);
      return {
        success: false,
        message: 'Assignment failed due to system error',
        conflictsDetected: true
      };
    }
  }

  /**
   * Try assignment with optimization support
   * This will trigger the continuous-optimizer to move existing reservations if beneficial
   */
  public static async tryAssignmentWithOptimization(
    companyId: string,
    date: string,
    time: string,
    partySize: number,
    notes?: string
  ): Promise<AutoAssignmentResult & { 
    optimizationApplied?: boolean;
    movedReservations?: number;
  }> {
    
    console.log(`🔄 [OPTIMIZATION] Starting optimization-assisted assignment...`);
    
    try {
      // Check if optimization is enabled for this company
      const { data: settings } = await supabase
        .from('company_settings')
        .select('optimization_enabled, optimization_mode')
        .eq('company_id', companyId)
        .single();

      const optimizationEnabled = settings?.optimization_enabled || settings?.optimization_mode !== 'disabled';
      
      if (!optimizationEnabled) {
        console.log(`⚠️ [OPTIMIZATION] Optimization disabled for company ${companyId}`);
        return {
          success: false,
          message: 'Optimization not enabled for this company',
          optimizationApplied: false,
          movedReservations: 0
        };
      }

      // Check for global optimization hold before triggering
      try {
        const win = window as any;
        const localHold = localStorage.getItem('optimization_hold_until');
        const holdUntilMs = Math.max(
          typeof win.__OPTIMIZATION_HOLD_UNTIL === 'number' ? win.__OPTIMIZATION_HOLD_UNTIL : 0,
          localHold ? new Date(localHold).getTime() : 0
        );
        const nowMs = Date.now();
        if (holdUntilMs && nowMs < holdUntilMs) {
          console.log(`⏸️ OPT_HOLD_DEFERRED (SmartAssignment): Hold active until ${new Date(holdUntilMs).toISOString()}`);
          return {
            success: false,
            message: 'Optimization temporarily blocked due to recent manual changes',
            optimizationApplied: false,
            movedReservations: 0
          };
        }
      } catch {}

      // Trigger the continuous optimizer to free up space for this reservation
      console.log(`🚀 [OPTIMIZATION] Triggering continuous optimizer...`);
      const { data: optimizerResult, error: optimizerError } = await supabase.functions.invoke(
        'continuous-optimizer',
        {
          body: {
            companyId,
            mode: 'immediate',
            targetDate: date,
            targetTime: time,
            targetPartySize: partySize,
            isAuthenticatedAdmin: true
          }
        }
      );

      if (optimizerError) {
        console.error('❌ [OPTIMIZATION] Optimizer call failed:', optimizerError);
        return {
          success: false,
          message: 'Optimization service unavailable',
          optimizationApplied: false,
          movedReservations: 0
        };
      }

      const optimizerData = optimizerResult || {};
      console.log(`📊 [OPTIMIZATION] Optimizer result:`, optimizerData);

      // Wait a moment for the optimizer to complete its work
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try assignment again after optimization
      console.log(`🔄 [OPTIMIZATION] Retrying assignment after optimization...`);
      const retryResult = await SmartAutoAssignmentService.assignBestTable(
        companyId, date, time, partySize, notes
      );

      if (retryResult.success) {
        return {
          ...retryResult,
          optimizationApplied: true,
          movedReservations: optimizerData.movesCount || 0,
          message: `${retryResult.message} (after optimizing ${optimizerData.movesCount || 0} reservation${optimizerData.movesCount === 1 ? '' : 's'})`
        };
      }

      console.log(`❌ [OPTIMIZATION] Assignment still failed after optimization`);
      return {
        success: false,
        message: 'No suitable assignment found even after optimization',
        optimizationApplied: true,
        movedReservations: optimizerData.movesCount || 0
      };

    } catch (error) {
      console.error('❌ [OPTIMIZATION] Optimization-assisted assignment error:', error);
      return {
        success: false,
        message: 'Optimization-assisted assignment failed',
        optimizationApplied: false,
        movedReservations: 0
      };
    }
  }

  /**
   * Check if optimization would be beneficial for a given assignment request
   */
  static async canOptimizeForAssignment(
    companyId: string,
    date: string,
    time: string,
    partySize: number
  ): Promise<boolean> {
    try {
      // Check if there are any reservations that could potentially be moved
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select('id, table_number, table_numbers, party_size, time, status')
        .eq('company_id', companyId)
        .eq('date', date)
        .in('status', ['confirmed', 'pending'])
        .limit(20);

      if (error || !reservations?.length) {
        return false;
      }

      // Simple heuristic: if there are multiple small reservations that could be combined
      // or moved to free up larger tables, optimization might be beneficial
      const smallReservations = reservations.filter(r => r.party_size <= 4);
      const largeTablesNeeded = partySize > 8;

      return smallReservations.length >= 2 || (largeTablesNeeded && smallReservations.length > 0);
      
    } catch (error) {
      console.error('Error checking optimization potential:', error);
      return false;
    }
  }

  /**
   * Validate that an assignment is still valid (no conflicts)
   * This should be called right before saving the reservation
   */
  static async validateAssignment(
    companyId: string,
    date: string,
    time: string,
    assignedTables: number[]
  ): Promise<{ valid: boolean; conflicts?: string[] }> {
    try {
      const result = await ReservationConflictService.validateReservation(
        {
          date,
          time,
          table_numbers: assignedTables,
          party_size: 1 // Minimal validation
        },
        companyId
      );

      return {
        valid: !result.hasConflict,
        conflicts: result.hasConflict ? [result.conflictMessage || 'Table conflict detected'] : undefined
      };

    } catch (error) {
      console.error('Assignment validation error:', error);
      return {
        valid: false,
        conflicts: ['Validation failed due to system error']
      };
    }
  }

  /**
   * Get comprehensive assignment recommendations including optimization potential
   */
  static async getAssignmentRecommendations(
    companyId: string,
    date: string,
    time: string,
    partySize: number,
    notes?: string
  ): Promise<{
    canAssignDirectly: boolean;
    canOptimizeToAssign: boolean;
    alternativeTimes: string[];
    suggestedStrategy: string;
    optimizationPotential?: number;
  }> {
    try {
      // Check direct assignment capability
      const canAssignDirectly = await SmartAutoAssignmentService.canAutoAssign(
        companyId, partySize
      );

      // Check optimization potential
      const canOptimizeToAssign = await this.canOptimizeForAssignment(
        companyId, date, time, partySize
      );

      // Get alternative suggestions
      const suggestions = await SmartAutoAssignmentService.getSmartSuggestions(
        companyId, partySize, date, time
      );

      // Determine strategy
      let suggestedStrategy = 'manual';
      if (canAssignDirectly) {
        suggestedStrategy = 'direct';
      } else if (canOptimizeToAssign) {
        suggestedStrategy = 'optimize';
      } else if (suggestions.length > 0) {
        suggestedStrategy = 'alternative_time';
      }

      return {
        canAssignDirectly,
        canOptimizeToAssign,
        alternativeTimes: suggestions,
        suggestedStrategy,
        optimizationPotential: canOptimizeToAssign ? 75 : 0 // Rough estimate
      };

    } catch (error) {
      console.error('Error getting assignment recommendations:', error);
      return {
        canAssignDirectly: false,
        canOptimizeToAssign: false,
        alternativeTimes: [],
        suggestedStrategy: 'manual'
      };
    }
  }
}