
import { Reservation } from '@/types/reservation';
import { ReservationConflictService } from '@/services/reservationConflictService';

/**
 * Utility functions for detecting table and time conflicts
 * Updated to use centralized conflict service with standardized 2-hour duration
 */

/**
 * Convert time string to minutes for easier comparison
 */
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Check if there are any table conflicts for a given time and table combination
 * @deprecated Use ReservationConflictService.validateReservation instead for new code
 */
export const hasTableConflict = (
  targetTables: number[],
  requestedTime: string,
  existingReservations: Reservation[],
  draggedReservationId?: string
): boolean => {
  if (!requestedTime || !targetTables.length) return false;
  
  console.log('=== CHECKING TABLE CONFLICT (Legacy) ===', {
    targetTables,
    requestedTime,
    draggedReservationId,
    existingReservationsCount: existingReservations.length
  });
  
  const requestedStartMinutes = timeToMinutes(requestedTime);
  const requestedEndMinutes = requestedStartMinutes + 120; // Standardized 2-hour duration
  
  const conflicts = existingReservations.filter(reservation => {
    // Skip the reservation being dragged
    if (draggedReservationId && reservation.id === draggedReservationId) {
      return false;
    }
    
    const reservationTables = reservation.table_numbers || (reservation.table_number ? [reservation.table_number] : []);
    const hasTableOverlap = targetTables.some(table => reservationTables.includes(table));
    
    if (!hasTableOverlap || !reservation.time) return false;
    
    const resStartMinutes = timeToMinutes(reservation.time);
    const resEndMinutes = resStartMinutes + 120; // Standardized 2-hour duration
    
    const hasTimeOverlap = (requestedStartMinutes < resEndMinutes && requestedEndMinutes > resStartMinutes);
    
    if (hasTimeOverlap) {
      console.log('=== CONFLICT DETECTED ===', {
        conflictingReservation: {
          id: reservation.id,
          customer: reservation.customer_name,
          tables: reservationTables,
          time: reservation.time
        },
        requestedTables: targetTables,
        requestedTime
      });
    }
    
    return hasTimeOverlap;
  });
  
  const hasConflict = conflicts.length > 0;
  console.log('=== CONFLICT CHECK RESULT ===', {
    hasConflict,
    conflictCount: conflicts.length
  });
  
  return hasConflict;
};

/**
 * Get detailed conflict information for display purposes
 */
export const getConflictDetails = (
  targetTables: number[],
  requestedTime: string,
  existingReservations: Reservation[],
  draggedReservationId?: string
): { hasConflict: boolean; conflictingReservations: Reservation[] } => {
  if (!requestedTime || !targetTables.length) {
    return { hasConflict: false, conflictingReservations: [] };
  }
  
  const requestedStartMinutes = timeToMinutes(requestedTime);
  const requestedEndMinutes = requestedStartMinutes + 120; // Standardized 2-hour duration
  
  const conflictingReservations = existingReservations.filter(reservation => {
    if (draggedReservationId && reservation.id === draggedReservationId) {
      return false;
    }
    
    const reservationTables = reservation.table_numbers || (reservation.table_number ? [reservation.table_number] : []);
    const hasTableOverlap = targetTables.some(table => reservationTables.includes(table));
    
    if (!hasTableOverlap || !reservation.time) return false;
    
    const resStartMinutes = timeToMinutes(reservation.time);
    const resEndMinutes = resStartMinutes + 120; // Standardized 2-hour duration
    
    return (requestedStartMinutes < resEndMinutes && requestedEndMinutes > resStartMinutes);
  });
  
  return {
    hasConflict: conflictingReservations.length > 0,
    conflictingReservations
  };
};
