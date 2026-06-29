import { supabase } from '@/integrations/supabase/client';
import { Reservation } from '@/types/reservation';
import { toast } from 'sonner';

export interface ConflictValidationResult {
  hasConflict: boolean;
  conflictMessage?: string;
  alternativeTables?: Array<{
    table_number: number;
    seats: number;
    accessibility_friendly: boolean;
  }>;
}

export interface DoubleBookingAlert {
  conflict_date: string;
  conflict_time: string;
  table_number: number;
  reservation_count: number;
  reservation_details: Array<{
    id: string;
    customer_name: string;
    party_size: number;
    status: string;
    phone?: string;
  }>;
}

/**
 * BULLETPROOF conflict validation service with database-level protection
 * Uses advisory locking and mandatory validation to prevent double bookings
 */
export class ReservationConflictService {
  
  /**
   * MANDATORY validation - MUST be called before ANY save operation
   * Uses database-level advisory locking to prevent race conditions
   */
  static async validateReservation(
    reservation: {
      date: string;
      time: string;
      table_number?: number;
      table_numbers?: number[];
      party_size: number;
      notes?: string;
    },
    companyId: string,
    excludeReservationId?: string
  ): Promise<ConflictValidationResult> {
    try {
      // Build tables array from both fields
      const tables: number[] = [];
      if (reservation.table_number) {
        tables.push(reservation.table_number);
      }
      if (reservation.table_numbers && reservation.table_numbers.length > 0) {
        tables.push(...reservation.table_numbers);
      }

      // Skip validation if no tables assigned
      if (tables.length === 0) {
        return { hasConflict: false };
      }

      // Use BULLETPROOF database validation with advisory locking
      let data, error;
      
      try {
        const result = await supabase.rpc('secure_table_assignment_with_lock', {
          p_company_id: companyId,
          p_date: reservation.date,
          p_time: reservation.time,
          p_table_numbers: tables,
          p_party_size: reservation.party_size,
          p_exclude_reservation_id: excludeReservationId || null
        });
        
        data = result.data;
        error = result.error;
        
        // If RPC doesn't exist (404), fall back to simpler check
        if (error && (error.message?.includes('not found') || error.code === 'PGRST202')) {
          console.warn('secure_table_assignment_with_lock not available, using fallback validation');
          
          // Simple fallback: just check for basic conflicts without advisory lock
          const { data: conflictData, error: conflictError } = await supabase.rpc('check_table_conflict', {
            p_table_numbers: tables,
            p_date: reservation.date,
            p_time: reservation.time,
            p_exclude_reservation_id: excludeReservationId || null
          });
          
          if (conflictError) {
            console.error('Fallback validation also failed:', conflictError);
            return { hasConflict: true, conflictMessage: 'Unable to validate table availability' };
          }
          
          // check_table_conflict returns boolean - true means conflict exists
          if (conflictData === true) {
            return {
              hasConflict: true,
              conflictMessage: `Tables ${tables.join(', ')} are already booked`
            };
          }
          
          return { hasConflict: false };
        }
      } catch (rpcError: any) {
        console.error('RPC call failed completely:', rpcError);
        return { hasConflict: true, conflictMessage: 'Unable to validate table availability' };
      }

      if (error) {
        console.error('Validation failed:', error);
        toast.error('Failed to validate table availability');
        return { hasConflict: true, conflictMessage: 'Unable to validate table availability' };
      }

      // Type the response properly
      const result = data as { success: boolean; conflict: boolean; message: string; suggested_tables?: number[] };
      
      if (result?.conflict) {
        return {
          hasConflict: true,
          conflictMessage: result.message || `Tables ${tables.join(', ')} are already booked`,
          alternativeTables: (result.suggested_tables || []).map((tableNumber: number) => ({
            table_number: tableNumber,
            seats: 0, // Will be populated by getAlternativeTableSuggestions
            accessibility_friendly: false
          }))
        };
      }

      return { hasConflict: false };

    } catch (error) {
      console.error('Bulletproof conflict validation error:', error);
      return {
        hasConflict: true,
        conflictMessage: 'Unable to validate table availability. Please try again.'
      };
    }
  }

  /**
   * Get alternative table suggestions when primary choice is unavailable
   */
  static async getAlternativeTableSuggestions(
    date: string,
    time: string,
    partySize: number,
    companyId: string,
    accessibilityNeeded: boolean = false
  ): Promise<Array<{ table_number: number; seats: number; accessibility_friendly: boolean }>> {
    try {
      const { data, error } = await supabase.rpc('suggest_alternative_tables', {
        p_company_id: companyId,
        p_date: date,
        p_time: time,
        p_party_size: partySize,
        p_accessibility_needed: accessibilityNeeded
      });

      if (error) {
        console.error('Error getting alternative tables:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting alternative tables:', error);
      return [];
    }
  }

  /**
   * Detect accessibility needs from reservation notes
   */
  static detectAccessibilityNeeds(notes: string): boolean {
    // Use the new centralized detection utility
    const { analyzeAccessibilityNotes } = require('../utils/accessibilityDetection');
    const analysis = analyzeAccessibilityNotes(notes);
    return analysis.needsAccessible;
  }

  /**
   * Detect existing double bookings in the system
   */
  static async detectDoubleBookings(companyId: string): Promise<DoubleBookingAlert[]> {
    try {
      const { data, error } = await supabase.rpc('detect_existing_double_bookings', {
        p_company_id: companyId
      });

      if (error) {
        console.error('Error detecting double bookings:', error);
        return [];
      }

      return (data || []).map((conflict: any) => ({
        conflict_date: conflict.conflict_date,
        conflict_time: conflict.conflict_time,
        table_number: conflict.table_number,
        reservation_count: conflict.reservation_count,
        reservation_details: conflict.reservation_details || []
      }));
    } catch (error) {
      console.error('Error detecting double bookings:', error);
      return [];
    }
  }

  /**
   * Validate reservation before database save
   * Throws error if conflict detected to prevent save
   */
  static async validateBeforeSave(
    reservation: Partial<Reservation>,
    companyId: string,
    excludeReservationId?: string
  ): Promise<void> {
    if (!reservation.date || !reservation.time || !reservation.party_size) {
      throw new Error('Required reservation details missing');
    }

    const result = await this.validateReservation(
      {
        date: reservation.date,
        time: reservation.time,
        table_number: reservation.table_number,
        table_numbers: reservation.table_numbers,
        party_size: reservation.party_size,
        notes: reservation.notes
      },
      companyId,
      excludeReservationId
    );

    if (result.hasConflict) {
      // Customize error message based on whether this is an edit or new reservation
      const errorMessage = excludeReservationId 
        ? "Can't Edit Reservation - Overlaps Existing Booking"
        : "Can't Create Reservation - Overlaps Existing Booking";
      
      throw new Error(result.conflictMessage || errorMessage);
    }
  }
}

/**
 * Time utility functions with standardized 2-hour duration
 */
export const TimeUtils = {
  /**
   * Convert time string to minutes for calculations
   */
  timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  },

  /**
   * Check if two time slots overlap (using standard 2-hour duration)
   */
  timeSlotsOverlap(time1: string, time2: string): boolean {
    const start1 = this.timeToMinutes(time1);
    const end1 = start1 + 120; // 2 hours
    const start2 = this.timeToMinutes(time2);
    const end2 = start2 + 120; // 2 hours

    return start1 < end2 && end1 > start2;
  },

  /**
   * Get end time for a reservation (2 hours after start)
   */
  getEndTime(startTime: string): string {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = startMinutes + 120; // 2 hours
    const hours = Math.floor(endMinutes / 60);
    const minutes = endMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
};