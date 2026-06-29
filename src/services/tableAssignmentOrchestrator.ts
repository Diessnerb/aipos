import { UniversalTableOptimizationService, OptimizationResult } from './universalTableOptimizationService';
import { SpaceMakingAnalysisService } from './spaceMakingAnalysisService';
import { GlobalTableRebalanceService } from './globalTableRebalanceService';
import { Reservation } from '@/types/reservation';
import { toast } from 'sonner';
import { DEBUG_CONFIG } from '@/utils/debugConfig';
import { supabase } from '@/integrations/supabase/client';

/**
 * Table Assignment Orchestrator
 * Provides a simple interface for all table assignment operations
 * Ensures universal optimization logic is applied consistently
 */
export class TableAssignmentOrchestrator {
  /**
   * Assign tables for a new reservation
   */
  static async assignForNewReservation(
    companyId: string,
    partySize: number,
    date: string,
    time: string,
    showToast: boolean = true
  ): Promise<OptimizationResult> {
    const result = await UniversalTableOptimizationService.findOptimalAssignment(
      companyId,
      partySize,
      date,
      time,
      undefined,
      null,
      false // Manual user action
    );

    // Toast notifications removed - handled by drag-drop handlers

    return result;
  }

  /**
   * Assign tables for editing an existing reservation
   */
  static async assignForReservationEdit(
    companyId: string,
    partySize: number,
    date: string,
    time: string,
    existingReservation: Reservation,
    showToast: boolean = true
  ): Promise<OptimizationResult> {
    const result = await UniversalTableOptimizationService.findOptimalAssignment(
      companyId,
      partySize,
      date,
      time,
      existingReservation.id,
      existingReservation,
      false // Manual user action
    );

    // Toast notifications removed - handled by drag-drop handlers

    return result;
  }

  /**
   * Auto-assign tables (automated optimization)
   * Includes space-making and global rebalancing fallbacks
   */
  static async autoAssignTables(
    companyId: string,
    partySize: number,
    date: string,
    time: string,
    existingReservation?: Reservation | null,
    allowStartedMoves: boolean = true
  ): Promise<OptimizationResult> {
    // Step 1: Try direct assignment with universal optimization (with notes for accessibility)
    const notes = existingReservation?.notes || '';
    const directResult = await UniversalTableOptimizationService.findOptimalAssignment(
      companyId,
      partySize,
      date,
      time,
      existingReservation?.id,
      existingReservation,
      true, // Automated action - respects temporary lock
      notes
    );

    // Validate that assigned tables are available (fail-safe layer)
    if (directResult.success && directResult.tables && directResult.tables.length > 0) {
      const { data: assignedTables } = await supabase
        .from('tables')
        .select('table_number, service_status, is_active')
        .eq('company_id', companyId)
        .in('table_number', directResult.tables);
      
      const unavailable = assignedTables?.filter(t => 
        !t.is_active || 
        (t.service_status && !['available', null].includes(t.service_status))
      );
      
      if (unavailable && unavailable.length > 0) {
        console.error('❌ Assignment included unavailable tables:', unavailable);
        return {
          success: false,
          tables: [],
          reason: `Tables ${unavailable.map(t => t.table_number).join(', ')} are not available`,
          strategy: 'failed',
          wastedSeats: 0,
          totalSeats: 0,
          error: 'Assignment validation failed'
        };
      }
    }

    // If successful, return immediately
    if (directResult.success) {
      console.log(`✅ Direct assignment succeeded for ${partySize} guests`);
      return directResult;
    }

    console.log(`🎯 [AUTO-ASSIGN] Step 2: Trying "Make Space For THIS Reservation" mode for ${partySize} guests...`);
    console.log(`📊 [AUTO-ASSIGN] Context: ${date} ${time}, allowStartedMoves: ${allowStartedMoves}`);

    // NEW: Call edge function with make_space_for_incoming mode
    try {
      const { data: makeSpaceData, error: makeSpaceError } = await supabase.functions.invoke('continuous-optimizer', {
        body: {
          companyId,
          mode: 'make_space_for_incoming',
          targetDate: date,
          targetTime: time,
          targetPartySize: partySize,
          automated: true,
          allowStartedMoves,
          allowImminentMoves: true
        }
      });

      if (!makeSpaceError && makeSpaceData?.success && makeSpaceData?.movesCount > 0) {
        console.log(`✅ [AUTO-ASSIGN] Make Space mode relocated ${makeSpaceData.movesCount} inefficient reservations`);
        
        // Try assignment again after making space
        const retryResult = await UniversalTableOptimizationService.findOptimalAssignment(
          companyId,
          partySize,
          date,
          time,
          existingReservation?.id,
          existingReservation,
          true
        );

        if (retryResult.success) {
          return {
            ...retryResult,
            spaceMakingApplied: true,
            movedReservations: makeSpaceData.movesCount,
            reason: `${retryResult.reason} (after relocating ${makeSpaceData.movesCount} inefficient bookings)`
          };
        }
      }
    } catch (error) {
      console.error('[AUTO-ASSIGN] Make Space mode failed:', error);
    }
    
    console.log(`📊 [AUTO-ASSIGN] Step 3: Falling back to legacy space-making...`);

    // Fallback to legacy space_making mode
    try {
      const { data: spaceMakingData, error: spaceMakingError } = await supabase.functions.invoke('continuous-optimizer', {
        body: {
          companyId,
          mode: 'space_making',
          targetDate: date,
          targetTime: time,
          targetPartySize: partySize,
          automated: true,
          allowStartedMoves,
          allowImminentMoves: true
        }
      });

      if (!spaceMakingError && spaceMakingData?.success && spaceMakingData?.movesCount > 0) {
        console.log(`✅ [AUTO-ASSIGN] Legacy space-making freed up tables: ${spaceMakingData.movesCount} moves`);
        
        // Try assignment again after freeing up space
        const retryResult = await UniversalTableOptimizationService.findOptimalAssignment(
          companyId,
          partySize,
          date,
          time,
          existingReservation?.id,
          existingReservation,
          true
        );

        if (retryResult.success) {
          return {
            ...retryResult,
            spaceMakingApplied: true,
            movedReservations: spaceMakingData.movesCount,
            reason: `${retryResult.reason} (after space-making: ${spaceMakingData.movesCount} moves)`
          };
        }
      }
    } catch (error) {
      console.error('[AUTO-ASSIGN] Space-making failed:', error);
    }

    // Step 4: Try global rebalancing via edge function as last resort
    console.log(`🌍 [AUTO-ASSIGN] Step 4: Triggering global rebalancing via edge function...`);
    
    try {
      const { data: rebalanceData, error: rebalanceError } = await supabase.functions.invoke('continuous-optimizer', {
        body: {
          companyId,
          mode: 'strategic',
          targetDate: date,
          targetTime: time,
          targetPartySize: partySize,
          automated: true,
          forceDeepOptimization: true,
          allowStartedMoves,
          allowImminentMoves: true
        }
      });

      if (!rebalanceError && rebalanceData?.success && rebalanceData?.movesCount > 0) {
        console.log(`✅ [AUTO-ASSIGN] Global rebalancing successful: ${rebalanceData.movesCount} moves`);
        
        // Try assignment one more time after rebalancing
        const finalRetry = await UniversalTableOptimizationService.findOptimalAssignment(
          companyId,
          partySize,
          date,
          time,
          existingReservation?.id,
          existingReservation,
          true
        );

        if (finalRetry.success) {
          return {
            ...finalRetry,
            globalRebalancingApplied: true,
            movedReservations: rebalanceData.movesCount,
            reason: `${finalRetry.reason} (after global rebalancing: ${rebalanceData.movesCount} moves)`
          };
        }
      }
    } catch (error) {
      console.error('[AUTO-ASSIGN] Global rebalancing failed:', error);
    }

    // All attempts failed
    console.log(`❌ [AUTO-ASSIGN] All assignment attempts failed for ${partySize} guests`);
    return {
      ...directResult,
      reason: `Unable to assign tables: ${directResult.reason}. Tried space-making and rebalancing.`
    };
  }

  /**
   * Check if tables can be assigned without actually assigning
   */
  static async checkAssignmentPossible(
    companyId: string,
    partySize: number,
    date: string,
    time: string
  ): Promise<{ possible: boolean; reason: string }> {
    const result = await UniversalTableOptimizationService.findOptimalAssignment(
      companyId,
      partySize,
      date,
      time,
      undefined,
      null,
      false
    );

    return {
      possible: result.success,
      reason: result.reason
    };
  }

  /**
   * Update manual move timestamp (call this when user manually moves a reservation)
   */
  static async markManualMove(reservationId: string): Promise<void> {
    await UniversalTableOptimizationService.updateManualMoveTimestamp(reservationId);
  }

  /**
   * Toggle permanent lock on reservation
   */
  static async toggleLock(reservationId: string, locked: boolean): Promise<void> {
    await UniversalTableOptimizationService.togglePermanentLock(reservationId, locked);
    // Don't show toast for lock toggle - silent system operation
  }
}
