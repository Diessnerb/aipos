/**
 * Table Status Change Handler
 * Manages cascading updates when a table's service status changes
 */

import { supabase } from '@/integrations/supabase/client';
import { Reservation } from '@/types/reservation';
import { TableAssignmentOrchestrator } from './tableAssignmentOrchestrator';

export interface StatusChangeImpact {
  affectedReservations: Reservation[];
  reassignableReservations: Reservation[];
  impossibleReservations: Reservation[];
  summary: string;
  reassignedCount: number;
  unassignedCount: number;
  failedCount: number;
}

interface ReassignmentResult {
  success: boolean;
  action: 'reassigned' | 'unassigned' | 'failed';
}

export class TableStatusChangeHandler {
  /**
   * Handle status change from available to unavailable (out_of_service or temporarily_removed)
   */
  static async handleStatusChange(
    tableNumber: number,
    oldStatus: string,
    newStatus: string,
    companyId: string
  ): Promise<StatusChangeImpact> {
    console.log('🔄 [StatusChange] Handling table status change:', {
      tableNumber,
      oldStatus,
      newStatus,
      companyId
    });

    // If changing to available, no need to reassign
    if (newStatus === 'available') {
      return {
        affectedReservations: [],
        reassignableReservations: [],
        impossibleReservations: [],
        summary: 'Table is now available - no reassignments needed',
        reassignedCount: 0,
        unassignedCount: 0,
        failedCount: 0
      };
    }

    // Find ALL affected reservations (active and future)
    const affectedReservations = await this.findAffectedReservations(
      tableNumber,
      companyId
    );

    if (affectedReservations.length === 0) {
      return {
        affectedReservations: [],
        reassignableReservations: [],
        impossibleReservations: [],
        summary: 'No reservations affected',
        reassignedCount: 0,
        unassignedCount: 0,
        failedCount: 0
      };
    }

    console.log('⚠️ [StatusChange] Found affected reservations:', affectedReservations.length);

    // Immediately process ALL affected reservations
    let reassignedCount = 0;
    let unassignedCount = 0;
    let failedCount = 0;

    const reassigned: Reservation[] = [];
    const unassigned: Reservation[] = [];
    const failed: Reservation[] = [];

    for (const reservation of affectedReservations) {
      console.log(`🔄 [StatusChange] Processing: ${reservation.customer_name} (${reservation.status})`);
      
      const result = await this.tryReassignReservation(
        reservation,
        tableNumber,
        companyId
      );

      if (result.action === 'reassigned') {
        reassignedCount++;
        reassigned.push(reservation);
        console.log(`✅ [StatusChange] Reassigned: ${reservation.customer_name}`);
      } else if (result.action === 'unassigned') {
        unassignedCount++;
        unassigned.push(reservation);
        console.log(`❌ [StatusChange] Unassigned: ${reservation.customer_name}`);
      } else {
        failedCount++;
        failed.push(reservation);
        console.error(`🚨 [StatusChange] Failed to process: ${reservation.customer_name}`);
      }
    }

    const total = affectedReservations.length;
    let summary = `${total} reservation(s) updated: `;
    const parts: string[] = [];
    
    if (reassignedCount > 0) parts.push(`${reassignedCount} reassigned`);
    if (unassignedCount > 0) parts.push(`${unassignedCount} unassigned`);
    if (failedCount > 0) parts.push(`${failedCount} failed`);
    
    summary += parts.join(', ');

    return {
      affectedReservations,
      reassignableReservations: reassigned,
      impossibleReservations: [...unassigned, ...failed],
      summary,
      reassignedCount,
      unassignedCount,
      failedCount
    };
  }

  /**
   * Find all future reservations using a specific table
   */
  private static async findAffectedReservations(
    tableNumber: number,
    companyId: string
  ): Promise<Reservation[]> {
    const today = new Date().toISOString().split('T')[0];

    // Include ALL statuses that need reassignment
    const affectedStatuses = [
      'confirmed',
      'pending',
      'late',
      // All active dining statuses
      'seated',
      'waiting-for-order',
      'waiting-for-starters',
      'starters-ready-in-kitchen',
      'starters-served',
      'requires-check-back-on-starters',
      'eating-starters',
      'clear-starters',
      'waiting-for-mains',
      'mains-ready-in-kitchen',
      'mains-served',
      'requires-check-back-on-mains',
      'eating-mains',
      'clear-mains',
      'waiting-for-desserts',
      'desserts-ready-in-kitchen',
      'desserts-served',
      'requires-check-back-on-desserts',
      'eating-dessert',
      'clear-desserts',
      'table-cleared',
      'bill-requested-waiting-to-pay'
    ];

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('company_id', companyId)
      .gte('date', today)
      .in('status', affectedStatuses)
      .or(`table_number.eq.${tableNumber},table_numbers.cs.{${tableNumber}}`);

    if (error) {
      console.error('Error finding affected reservations:', error);
      return [];
    }

    return (data as Reservation[]) || [];
  }

  /**
   * Try to reassign a reservation to alternative tables, or unassign if not possible
   */
  private static async tryReassignReservation(
    reservation: Reservation,
    unavailableTable: number,
    companyId: string
  ): Promise<ReassignmentResult> {
    try {
      console.log('🔄 [StatusChange] Attempting to reassign reservation:', {
        id: reservation.id,
        customer: reservation.customer_name,
        partySize: reservation.party_size,
        currentTables: reservation.table_numbers || [reservation.table_number]
      });

      // Try to find alternative assignment (allow moving started reservations for table service)
      const result = await TableAssignmentOrchestrator.autoAssignTables(
        companyId,
        reservation.party_size,
        reservation.date,
        reservation.time,
        reservation,
        true // Allow started moves for table service
      );

      if (result.success && result.tables && result.tables.length > 0) {
        // Check if the new assignment doesn't include the unavailable table
        const usesUnavailableTable = result.tables.includes(unavailableTable);
        
        if (!usesUnavailableTable) {
          console.log('✅ [StatusChange] Found alternative assignment:', result.tables);
          
          // Update the reservation with new tables
          const { error: updateError } = await supabase
            .from('reservations')
            .update({
              table_numbers: result.tables,
              table_number: result.tables[0]
            })
            .eq('id', reservation.id);

          if (updateError) {
            console.error('Error updating reservation:', updateError);
            return { success: false, action: 'failed' };
          }

          return { success: true, action: 'reassigned' };
        }
      }

      // If reassignment failed, unassign the reservation
      console.log('⚠️ [StatusChange] No suitable alternative - unassigning reservation');
      return await this.unassignReservation(reservation);
    } catch (error) {
      console.error('Error trying to reassign reservation:', error);
      return { success: false, action: 'failed' };
    }
  }

  /**
   * Unassign a reservation from its tables
   */
  private static async unassignReservation(
    reservation: Reservation
  ): Promise<ReassignmentResult> {
    try {
      // Determine the appropriate status
      const isActivelyDining = [
        'seated', 'waiting-for-order', 'eating-starters', 'eating-mains', 'eating-dessert'
      ].includes(reservation.status);
      
      const newStatus = isActivelyDining ? 'confirmed' : reservation.status;

      const { error } = await supabase
        .from('reservations')
        .update({
          table_numbers: null,
          table_number: null,
          status: newStatus
        })
        .eq('id', reservation.id);

      if (error) {
        console.error('Error unassigning reservation:', error);
        return { success: false, action: 'failed' };
      }

      console.log(`❌ [StatusChange] Unassigned: ${reservation.customer_name}`);
      return { success: true, action: 'unassigned' };
    } catch (error) {
      console.error('Error in unassignReservation:', error);
      return { success: false, action: 'failed' };
    }
  }

  /**
   * Auto-reassign all affected reservations (with user confirmation handled by caller)
   */
  static async autoReassignAll(
    tableNumber: number,
    companyId: string
  ): Promise<{ success: number; failed: number }> {
    const affectedReservations = await this.findAffectedReservations(
      tableNumber,
      companyId
    );

    let success = 0;
    let failed = 0;

    for (const reservation of affectedReservations) {
      const reassigned = await this.tryReassignReservation(
        reservation,
        tableNumber,
        companyId
      );

      if (reassigned) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Execute reassignments that were already calculated in the impact analysis
   */
  static async executeReassignments(
    impact: StatusChangeImpact,
    tableNumber: number,
    companyId: string
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    console.log('🔄 [StatusChange] Executing reassignments for confirmed reservations...');

    for (const reservation of impact.reassignableReservations) {
      const reassigned = await this.tryReassignReservation(
        reservation,
        tableNumber,
        companyId
      );

      if (reassigned) {
        success++;
      } else {
        failed++;
      }
    }

    console.log(`✅ [StatusChange] Executed ${success} reassignments, ${failed} failed`);
    return { success, failed };
  }
}
