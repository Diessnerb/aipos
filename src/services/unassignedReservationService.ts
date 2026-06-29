import { supabase } from '@/integrations/supabase/client';
import { TableAssignmentOrchestrator } from './tableAssignmentOrchestrator';

interface UnassignedReservation {
  id: string;
  customer_name: string;
  party_size: number;
  date: string;
  time: string;
  notes?: string;
  company_id: string;
  status: string;
}

interface AutoAssignmentResult {
  success: boolean;
  assignedCount: number;
  failedCount: number;
  details: Array<{
    reservationId: string;
    customerName: string;
    success: boolean;
    assignedTables?: number[];
    error?: string;
  }>;
}

export class UnassignedReservationService {
  /**
   * Find all unassigned reservations for a company
   * Only active reservations (not cancelled) should have table assignments
   */
  static async findUnassignedReservations(companyId: string): Promise<UnassignedReservation[]> {
    try {
      const { data: unassigned, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('company_id', companyId)
        .neq('status', 'cancelled') // Only cancelled reservations should remain unassigned
        .or('table_number.is.null,table_numbers.is.null'); // No table assignment

      if (error) {
        console.error('Error fetching unassigned reservations:', error);
        return [];
      }

      console.log(`🎯 Found ${unassigned?.length || 0} unassigned reservations for company ${companyId}`);
      
      return unassigned?.map(r => ({
        id: r.id,
        customer_name: r.customer_name,
        party_size: r.party_size,
        date: r.date,
        time: r.time,
        notes: r.notes,
        company_id: r.company_id,
        status: r.status
      })) || [];

    } catch (error) {
      console.error('Error in findUnassignedReservations:', error);
      return [];
    }
  }

  /**
   * Auto-assign tables to all unassigned reservations
   * This ensures only cancelled reservations remain unassigned
   */
  static async autoAssignUnassignedReservations(companyId: string): Promise<AutoAssignmentResult> {
    console.log(`🤖 AUTO-ASSIGNMENT: Processing unassigned reservations for company ${companyId}`);

    try {
      const unassignedReservations = await this.findUnassignedReservations(companyId);
      
      if (unassignedReservations.length === 0) {
        return {
          success: true,
          assignedCount: 0,
          failedCount: 0,
          details: []
        };
      }

      console.log(`📋 Processing ${unassignedReservations.length} unassigned reservations`);

      const results: AutoAssignmentResult['details'] = [];
      let assignedCount = 0;
      let failedCount = 0;

      // Sort by priority: earliest dates first, largest parties first
      const sortedReservations = unassignedReservations.sort((a, b) => {
        const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateComparison !== 0) return dateComparison;
        
        // For same date, prioritize larger parties (harder to accommodate)
        return b.party_size - a.party_size;
      });

      for (const reservation of sortedReservations) {
        try {
          console.log(`🔄 Auto-assigning ${reservation.customer_name} (${reservation.party_size} guests) for ${reservation.date} ${reservation.time}`);

          // Use universal optimization logic via TableAssignmentOrchestrator
          const assignmentResult = await TableAssignmentOrchestrator.autoAssignTables(
            companyId,
            reservation.party_size,
            reservation.date,
            reservation.time,
            null // No existing reservation for unassigned
          );

          if (assignmentResult.success && assignmentResult.tables?.length > 0) {
            // Update the reservation with assigned tables
            await this.updateReservationTables(
              reservation.id,
              assignmentResult.tables
            );

            results.push({
              reservationId: reservation.id,
              customerName: reservation.customer_name,
              success: true,
              assignedTables: assignmentResult.tables
            });

            assignedCount++;
            console.log(`✅ Successfully assigned ${reservation.customer_name} to table(s): ${assignmentResult.tables.join(', ')} via ${assignmentResult.strategy}`);

          } else {
            results.push({
              reservationId: reservation.id,
              customerName: reservation.customer_name,
              success: false,
              error: assignmentResult.reason || 'No suitable tables available'
            });

            failedCount++;
            console.log(`❌ Failed to assign ${reservation.customer_name}: ${assignmentResult.reason}`);
          }

        } catch (error) {
          console.error(`🚨 Error assigning ${reservation.customer_name}:`, error);
          
          results.push({
            reservationId: reservation.id,
            customerName: reservation.customer_name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          failedCount++;
        }
      }

      const result = {
        success: assignedCount > 0,
        assignedCount,
        failedCount,
        details: results
      };

      console.log(`🎉 AUTO-ASSIGNMENT COMPLETE: ${assignedCount} assigned, ${failedCount} failed`);
      
      return result;

    } catch (error) {
      console.error('🚨 Auto-assignment process failed:', error);
      
      return {
        success: false,
        assignedCount: 0,
        failedCount: 0,
        details: []
      };
    }
  }

  /**
   * Update reservation with assigned tables
   */
  private static async updateReservationTables(
    reservationId: string,
    assignedTables: number[]
  ): Promise<void> {
    const updateData = assignedTables.length === 1 
      ? { 
          table_number: assignedTables[0],
          table_numbers: null 
        }
      : { 
          table_number: null,
          table_numbers: assignedTables 
        };

    const { error } = await supabase
      .from('reservations')
      .update(updateData)
      .eq('id', reservationId);

    if (error) {
      throw new Error(`Failed to update reservation ${reservationId}: ${error.message}`);
    }
  }

  /**
   * Run continuous monitoring for unassigned reservations
   * This ensures all active reservations have table assignments
   */
  static async runContinuousAutoAssignment(companyId: string): Promise<void> {
    console.log(`🔄 CONTINUOUS AUTO-ASSIGNMENT: Monitoring company ${companyId}`);

    try {
      const result = await this.autoAssignUnassignedReservations(companyId);
      
      if (result.assignedCount > 0) {
        console.log(`✅ Continuous auto-assignment: ${result.assignedCount} reservations assigned`);
      }

    } catch (error) {
      console.error('🚨 Continuous auto-assignment failed:', error);
    }
  }
}