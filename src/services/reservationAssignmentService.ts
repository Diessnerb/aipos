/**
 * Unified Reservation Assignment Service
 * 
 * This service provides a single entry point for all table assignment operations
 * throughout the application, ensuring consistent logic and behavior across
 * all modals, buttons, and assignment workflows.
 * 
 * NOW USES UNIVERSAL TABLE OPTIMIZATION SERVICE
 */

import { TableAssignmentOrchestrator } from './tableAssignmentOrchestrator';
import { SmartReservationAssignmentService } from './smartReservationAssignmentService';
import { supabase } from '@/integrations/supabase/client';
import { offlineAwareInsert } from '@/utils/offlineAwareSupabase';

export interface UnifiedAssignmentResult {
  success: boolean;
  assignedTables: number[];
  assignedTable?: number; // Single table for backward compatibility
  message: string;
  assignmentStrategy?: string;
  optimizationApplied?: boolean;
  movedReservations?: number;
  alternativeOptions?: {
    tables: number[];
    reason: string;
    confidence: number;
  }[];
  // Legacy compatibility fields
  alternativeTimes?: string[];
  tableSeats?: number;
  efficiencyScore?: number;
  accessibilityFriendly?: boolean;
  appliedRules?: string[];
  conflictResolution?: {
    detected: boolean;
    resolved: boolean;
    details: string;
  };
}

export interface AssignmentHistoryEntry {
  reservationId: string;
  companyId: string;
  assignedTables: number[];
  strategy: string;
  ruleApplied: string;
  success: boolean;
  conflictDetected: boolean;
  optimizationApplied?: boolean;
  movedReservations?: number;
}

/**
 * Unified Reservation Assignment Service
 * 
 * This is the SINGLE entry point for all table assignment operations.
 * All modals, buttons, and workflows should use this service.
 */
export class ReservationAssignmentService {
  /**
   * Primary assignment method - use this for all assignment operations
   * NOW USES UNIVERSAL TABLE OPTIMIZATION
   */
  static async assignOptimalTables(
    companyId: string,
    date: string,
    time: string,
    partySize: number,
    notes?: string,
    reservationId?: string
  ): Promise<UnifiedAssignmentResult> {
    try {
      // Use the aggressive auto-assignment with full optimization chain
      const result = await TableAssignmentOrchestrator.autoAssignTables(
        companyId,
        partySize,
        date,
        time,
        reservationId ? { id: reservationId } as any : null
      );

      // Log assignment history
      if (reservationId && result.success) {
        await this.logAssignmentHistory({
          reservationId,
          companyId,
          assignedTables: result.tables || [],
          strategy: result.strategy || 'universal_optimization',
          ruleApplied: result.reason || 'Universal optimization applied',
          success: true,
          conflictDetected: false,
          optimizationApplied: false,
          movedReservations: 0
        });
      }

      return {
        success: result.success,
        assignedTables: result.tables || [],
        assignedTable: result.tables?.[0],
        message: result.reason || 'Assignment completed',
        assignmentStrategy: result.strategy,
        optimizationApplied: false,
        movedReservations: 0,
        // Legacy compatibility defaults
        alternativeTimes: [],
        tableSeats: result.totalSeats || 0,
        efficiencyScore: result.success ? 85 : 0,
        accessibilityFriendly: false,
        appliedRules: [result.strategy || 'universal_optimization'],
        conflictResolution: {
          detected: false,
          resolved: true,
          details: 'No conflicts detected'
        }
      };
    } catch (error) {
      console.error('Assignment failed:', error);
      
      // Log failed assignment
      if (reservationId) {
        await this.logAssignmentHistory({
          reservationId,
          companyId,
          assignedTables: [],
          strategy: 'smart_assignment',
          ruleApplied: `Assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          success: false,
          conflictDetected: false
        });
      }

      return {
        success: false,
        assignedTables: [],
        message: error instanceof Error ? error.message : 'Assignment failed',
        // Legacy compatibility defaults
        alternativeTimes: [],
        tableSeats: 0,
        efficiencyScore: 0,
        accessibilityFriendly: false,
        appliedRules: [],
        conflictResolution: {
          detected: true,
          resolved: false,
          details: error instanceof Error ? error.message : 'Assignment failed'
        }
      };
    }
  }

  /**
   * Get assignment recommendations without actually assigning
   */
  static async getAssignmentRecommendations(
    companyId: string,
    date: string,
    time: string,
    partySize: number,
    notes?: string
  ) {
    return SmartReservationAssignmentService.getAssignmentRecommendations(
      companyId,
      date,
      time,
      partySize,
      notes
    );
  }

  /**
   * Validate a proposed assignment for conflicts
   */
  static async validateAssignment(
    companyId: string,
    date: string,
    time: string,
    assignedTables: number[],
    excludeReservationId?: string
  ) {
    return SmartReservationAssignmentService.validateAssignment(
      companyId,
      date,
      time,
      assignedTables
    );
  }

  /**
   * Re-evaluate an existing reservation's assignment
   */
  static async reEvaluateAssignment(
    reservationId: string,
    companyId: string
  ): Promise<UnifiedAssignmentResult> {
    try {
      // Step 1: Clear current assignment and get reservation details
      const { data: clearResult, error: clearError } = await supabase
        .rpc('re_evaluate_full_assignment', {
          p_reservation_id: reservationId,
          p_company_id: companyId
        });

      if (clearError || !(clearResult as any)?.success) {
        throw new Error((clearResult as any)?.message || 'Failed to prepare reservation for re-evaluation');
      }

      const result = clearResult as any;
      const oldAssignment = result.old_assignment;
      const reservationDetails = result.reservation_details;

      // Step 2: Run full assignment logic
      const assignmentResult = await this.assignOptimalTables(
        companyId,
        reservationDetails.date,
        reservationDetails.time,
        reservationDetails.party_size,
        reservationDetails.notes,
        reservationId
      );

      if (assignmentResult.success && assignmentResult.assignedTables.length > 0) {
        // Step 3: Update the reservation with new assignment
        const { error: updateError } = await supabase
          .from('reservations')
          .update({
            table_number: assignmentResult.assignedTables.length === 1 ? assignmentResult.assignedTables[0] : null,
            table_numbers: assignmentResult.assignedTables
          })
          .eq('id', reservationId);

        if (updateError) {
          throw new Error('Failed to update reservation with new assignment');
        }

        // Compare old vs new assignment
        const oldTables = oldAssignment.table_numbers || [oldAssignment.table_number].filter(Boolean);
        const newTables = assignmentResult.assignedTables;
        const isChanged = JSON.stringify(oldTables?.sort()) !== JSON.stringify(newTables?.sort());
        
        return {
          ...assignmentResult,
          message: isChanged 
            ? `Assignment improved: ${oldTables?.join(', ')} → ${newTables.join(', ')}`
            : 'Current assignment is already optimal',
          // Ensure legacy compatibility fields are present
          alternativeTimes: assignmentResult.alternativeTimes || [],
          tableSeats: assignmentResult.tableSeats || 0,
          efficiencyScore: assignmentResult.efficiencyScore || 85,
          accessibilityFriendly: assignmentResult.accessibilityFriendly || false,
          appliedRules: assignmentResult.appliedRules || [],
          conflictResolution: assignmentResult.conflictResolution || {
            detected: false,
            resolved: true,
            details: 'Re-evaluation completed'
          }
        };
      } else {
        // Restore old assignment if no suitable option found
        await supabase
          .from('reservations')
          .update({
            table_number: oldAssignment.table_number,
            table_numbers: oldAssignment.table_numbers
          })
          .eq('id', reservationId);

        return {
          success: false,
          assignedTables: [],
          message: assignmentResult.message || 'No better assignment available - keeping current assignment',
          // Legacy compatibility defaults
          alternativeTimes: [],
          tableSeats: 0,
          efficiencyScore: 0,
          accessibilityFriendly: false,
          appliedRules: [],
          conflictResolution: {
            detected: false,
            resolved: false,
            details: 'No better assignment available'
          }
        };
      }
    } catch (error) {
      console.error('Re-evaluation failed:', error);
      return {
        success: false,
        assignedTables: [],
        message: error instanceof Error ? error.message : 'Re-evaluation failed',
        // Legacy compatibility defaults
        alternativeTimes: [],
        tableSeats: 0,
        efficiencyScore: 0,
        accessibilityFriendly: false,
        appliedRules: [],
        conflictResolution: {
          detected: true,
          resolved: false,
          details: error instanceof Error ? error.message : 'Re-evaluation failed'
        }
      };
    }
  }

  /**
   * Batch assign tables for multiple reservations
   */
  static async batchAssignTables(
    companyId: string,
    reservations: Array<{
      id: string;
      date: string;
      time: string;
      party_size: number;
      notes?: string;
    }>
  ): Promise<{
    totalProcessed: number;
    successfulAssignments: number;
    failedAssignments: number;
    results: Array<{ reservationId: string; result: UnifiedAssignmentResult }>;
  }> {
    const results: Array<{ reservationId: string; result: UnifiedAssignmentResult }> = [];
    let successfulAssignments = 0;
    let failedAssignments = 0;

    for (const reservation of reservations) {
      const result = await this.assignOptimalTables(
        companyId,
        reservation.date,
        reservation.time,
        reservation.party_size,
        reservation.notes,
        reservation.id
      );

      results.push({ reservationId: reservation.id, result });

      if (result.success) {
        successfulAssignments++;
        
        // Update the reservation in the database
        await supabase
          .from('reservations')
          .update({
            table_number: result.assignedTables.length === 1 ? result.assignedTables[0] : null,
            table_numbers: result.assignedTables
          })
          .eq('id', reservation.id);
      } else {
        failedAssignments++;
      }
    }

    return {
      totalProcessed: reservations.length,
      successfulAssignments,
      failedAssignments,
      results
    };
  }

  /**
   * Log assignment history for audit purposes
   */
  private static async logAssignmentHistory(entry: AssignmentHistoryEntry): Promise<void> {
    try {
      await offlineAwareInsert('assignment_history', {
        company_id: entry.companyId,
        reservation_id: entry.reservationId,
        assigned_tables: entry.assignedTables,
        assignment_strategy: entry.strategy,
        rule_applied: entry.ruleApplied,
        success: entry.success,
        conflict_detected: entry.conflictDetected
      });
    } catch (error) {
      console.error('Failed to log assignment history:', error);
      // Don't throw - logging failure shouldn't break assignment
    }
  }

  /**
   * Get assignment statistics for reporting
   */
  static async getAssignmentStats(companyId: string, startDate?: string, endDate?: string) {
    try {
      let query = supabase
        .from('assignment_history')
        .select('*')
        .eq('company_id', companyId);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      const total = data.length;
      const successful = data.filter(entry => entry.success).length;
      const strategies = data.reduce((acc, entry) => {
        acc[entry.assignment_strategy] = (acc[entry.assignment_strategy] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        total,
        successful,
        successRate: total > 0 ? (successful / total) * 100 : 0,
        strategies,
        recentEntries: data.slice(-10)
      };
    } catch (error) {
      console.error('Failed to get assignment stats:', error);
      return {
        total: 0,
        successful: 0,
        successRate: 0,
        strategies: {},
        recentEntries: []
      };
    }
  }
}