import { Reservation } from '@/types/reservation';
import { Table } from '@/types/table';
import { detectAccessibilityNeeds as detectionFunction, analyzeAccessibilityNotes } from './accessibilityDetection';
import { getAccessibleBudget } from './accessibilityForecast';

export interface AutoAssignmentResult {
  success: boolean;
  assignedTable?: number;
  reason?: string;
}

// Re-export for backward compatibility
export const detectAccessibilityNeeds = detectionFunction;

/**
 * Finds a suitable table for a reservation based on party size, accessibility needs, and seating preferences
 */
export const findSuitableTable = async (
  reservation: Reservation,
  availableTables: Table[],
  companyId?: string
): Promise<Table | null> => {
  const accessibilityAnalysis = analyzeAccessibilityNotes(reservation.notes || '');
  const { needsAccessible, avoidHighTop } = accessibilityAnalysis;
  
  // Get accessibility budget if company ID is provided
  let accessibilityBudget;
  if (companyId) {
    try {
      accessibilityBudget = await getAccessibleBudget(companyId, reservation.date, reservation.time);
    } catch (error) {
      console.error('Error getting accessibility budget:', error);
    }
  }
  
  // Filter tables based on requirements
  let suitableTables = availableTables.filter(table => {
    // Check if table has enough seats
    if (table.seats < reservation.party_size) return false;
    
    // Strict accessibility filtering for high/medium confidence
    if (needsAccessible && !table.accessibility_friendly) return false;
    
    // Avoid high-top tables for meal reservations unless explicitly OK
    if (avoidHighTop && table.is_high_top) return false;
    
    return true;
  });
  
  if (suitableTables.length === 0) return null;
  
  // Sort tables with preference logic
  suitableTables.sort((a, b) => {
    // If accessibility is NOT needed, apply budget-based penalty to accessible tables
    if (!needsAccessible && accessibilityBudget) {
      const aPenalty = (a.accessibility_friendly && accessibilityBudget.budget <= accessibilityBudget.recommendedSpare) ? 1000 : 0;
      const bPenalty = (b.accessibility_friendly && accessibilityBudget.budget <= accessibilityBudget.recommendedSpare) ? 1000 : 0;
      
      if (aPenalty !== bPenalty) {
        return aPenalty - bPenalty; // Prefer non-accessible when budget is tight
      }
    }
    
    // Always prefer non-high-top for dining unless explicitly OK
    if (avoidHighTop) {
      const aHighTopPenalty = a.is_high_top ? 500 : 0;
      const bHighTopPenalty = b.is_high_top ? 500 : 0;
      
      if (aHighTopPenalty !== bHighTopPenalty) {
        return aHighTopPenalty - bHighTopPenalty;
      }
    }
    
    // Sort by seats (smallest suitable table first)
    return a.seats - b.seats;
  });
  
  return suitableTables[0];
};

/**
 * Checks if a table is available at a specific time on a specific date
 * Updated to use standardized 2-hour (120 minutes) duration
 */
export const checkTableAvailability = (
  tableNumber: number,
  date: string,
  time: string,
  existingReservations: Reservation[],
  excludeReservationId?: string
): boolean => {
  const reservationTime = new Date(`${date}T${time}`);
  const reservationEndTime = new Date(reservationTime.getTime() + 120 * 60000); // 120 minutes (2 hours) standard
  
  return !existingReservations.some(reservation => {
    // Skip the reservation we're checking (for updates)
    if (excludeReservationId && reservation.id === excludeReservationId) {
      return false;
    }
    
    // Check if this reservation uses the target table
    const usesTable = reservation.table_number === tableNumber || 
                     (reservation.table_numbers && reservation.table_numbers.includes(tableNumber));
    
    if (!usesTable) return false;
    
    // Check time overlap
    const existingTime = new Date(`${reservation.date}T${reservation.time}`);
    const existingEndTime = reservation.end_time 
      ? new Date(`${reservation.date}T${reservation.end_time}`)
      : new Date(existingTime.getTime() + 120 * 60000); // Standard 2-hour duration
    
    // Check for time overlap
    return (reservationTime < existingEndTime && reservationEndTime > existingTime);
  });
};

/**
 * Attempts to automatically assign a table to a reservation
 */
export const assignTableToReservation = async (
  reservation: Reservation,
  availableTables: Table[],
  existingReservations: Reservation[],
  companyId?: string
): Promise<AutoAssignmentResult> => {
  // Skip cancelled, no-show, or completed reservations
  if (reservation.status === 'cancelled' || reservation.status === 'no-show' || reservation.status === 'completed') {
    return {
      success: false,
      reason: 'Cancelled, no-show, or completed reservations do not need table assignment.'
    };
  }
  
  // Skip if party size is too large (>10 people)
  if (reservation.party_size > 10) {
    return {
      success: false,
      reason: 'Party size exceeds maximum table capacity (10 people). Manual assignment required.'
    };
  }
  
  // Skip if already assigned
  if (reservation.table_number || (reservation.table_numbers && reservation.table_numbers.length > 0)) {
    return {
      success: false,
      reason: 'Reservation already has a table assigned.'
    };
  }
  
  // Find suitable table
  const suitableTable = await findSuitableTable(reservation, availableTables, companyId);
  
  if (!suitableTable) {
    const accessibilityAnalysis = analyzeAccessibilityNotes(reservation.notes || '');
    if (accessibilityAnalysis.needsAccessible) {
      return {
        success: false,
        reason: `No accessible tables available for party of ${reservation.party_size}. Please assign manually or ensure accessible tables are available.`
      };
    } else if (accessibilityAnalysis.avoidHighTop) {
      return {
        success: false,
        reason: `No suitable dining tables available for party of ${reservation.party_size}. All suitable tables may be occupied or only high-top seating is available.`
      };
    } else {
      return {
        success: false,
        reason: `No tables available for party of ${reservation.party_size}. All suitable tables may be occupied.`
      };
    }
  }
  
  // Check availability
  const isAvailable = checkTableAvailability(
    suitableTable.table_number,
    reservation.date,
    reservation.time,
    existingReservations,
    reservation.id
  );
  
  if (!isAvailable) {
    return {
      success: false,
      reason: 'Suitable table is already booked at this time.'
    };
  }
  
  return {
    success: true,
    assignedTable: suitableTable.table_number,
    reason: `Auto-assigned to Table ${suitableTable.table_number} (${suitableTable.seats} seats${suitableTable.accessibility_friendly ? ', accessible' : ''})`
  };
};