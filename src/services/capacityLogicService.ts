import { Table, TableGroup } from '@/types/table';

/**
 * Centralized service for handling table and group capacity calculations
 * Ensures consistent logic between full group bookings and partial group bookings
 */
export class CapacityLogicService {
  /**
   * Calculate capacity for full group booking
   * Uses max_combined_capacity (Available Seats) as configured by user
   */
  static calculateFullGroupCapacity(group: { max_combined_capacity: number }): number {
    return group.max_combined_capacity;
  }

  /**
   * Calculate remaining capacity for partial group booking
   * Uses individual table seats (no seat loss applied)
   */
  static calculatePartialGroupCapacity(
    remainingTables: Table[]
  ): number {
    if (!remainingTables.length) return 0;
    
    const totalSeats = remainingTables.reduce((sum, table) => sum + table.seats, 0);
    
    return totalSeats;
  }

  /**
   * Check if a party size can be accommodated by a full table group
   * Always uses max_combined_capacity (Available Seats)
   */
  static canAccommodateFullGroup(
    partySize: number, 
    group: { max_combined_capacity: number }
  ): boolean {
    return group.max_combined_capacity >= partySize;
  }

  /**
   * Check if a party size can be accommodated by partial tables
   * Uses individual table calculation (no seat loss)
   */
  static canAccommodatePartialGroup(
    partySize: number,
    remainingTables: Table[]
  ): boolean {
    const availableCapacity = this.calculatePartialGroupCapacity(remainingTables);
    return availableCapacity >= partySize;
  }

  /**
   * Calculate efficiency of group configuration
   * Shows how well Available Seats utilizes Individual Total
   */
  static calculateGroupEfficiency(
    availableSeats: number,
    individualTotal: number
  ): number {
    if (individualTotal === 0) return 0;
    return Math.round((availableSeats / individualTotal) * 100);
  }

  /**
   * Get the appropriate capacity value for booking logic
   * Full group: max_combined_capacity
   * Partial group: calculated from remaining tables
   */
  static getBookingCapacity(
    isFullGroup: boolean,
    group?: { max_combined_capacity: number },
    remainingTables?: Table[]
  ): number {
    if (isFullGroup && group) {
      return this.calculateFullGroupCapacity(group);
    }
    
    if (!isFullGroup && remainingTables) {
      return this.calculatePartialGroupCapacity(remainingTables);
    }
    
    return 0;
  }

  /**
   * Calculate minimal table assignment for a party size within a group
   * Returns the minimum number of tables needed with their actual capacity
   * NOW ENFORCES CONTIGUOUS ADJACENCY for table groups
   */
  static calculateMinimalTableAssignment(
    partySize: number,
    groupTables: Table[]
  ): {
    tables: Table[];
    actualCapacity: number;
    efficiency: number;
  } {
    if (!groupTables.length) {
      return { tables: [], actualCapacity: 0, efficiency: 0 };
    }

    // For contiguous selection, we need to try all possible contiguous slices
    // Sort tables by their table_number to ensure correct ordering
    const orderedTables = [...groupTables].sort((a, b) => a.table_number - b.table_number);
    
    let bestOption: {
      tables: Table[];
      actualCapacity: number;
      efficiency: number;
    } | null = null;

    // Try all contiguous slices of tables
    for (let start = 0; start < orderedTables.length; start++) {
      let currentTables: Table[] = [];
      let currentCapacity = 0;

      for (let end = start; end < orderedTables.length; end++) {
        currentTables.push(orderedTables[end]);
        currentCapacity += orderedTables[end].seats;

        // If this slice meets the capacity requirement
        if (currentCapacity >= partySize) {
          const efficiency = Math.round((partySize / currentCapacity) * 100);
          
          // Keep track of the best option (fewest tables, highest efficiency)
          if (!bestOption || 
              currentTables.length < bestOption.tables.length ||
              (currentTables.length === bestOption.tables.length && efficiency > bestOption.efficiency)) {
            bestOption = {
              tables: [...currentTables],
              actualCapacity: currentCapacity,
              efficiency
            };
          }
          
          break; // No need to extend this slice further
        }
      }
    }

    // If we found a valid contiguous option, return it
    if (bestOption) {
      return bestOption;
    }

    // Fallback: if no contiguous slice works, return all tables
    const totalCapacity = orderedTables.reduce((sum, t) => sum + t.seats, 0);
    return {
      tables: orderedTables,
      actualCapacity: totalCapacity,
      efficiency: Math.round((partySize / totalCapacity) * 100)
    };
  }

  /**
   * Determine if a partial table assignment is more efficient than full group usage
   */
  static shouldUsePartialAssignment(
    partySize: number,
    group: { max_combined_capacity: number },
    groupTables: Table[]
  ): {
    usePartial: boolean;
    partialAssignment?: { tables: Table[]; actualCapacity: number; efficiency: number };
    reason: string;
  } {
    const fullGroupEfficiency = Math.round((partySize / group.max_combined_capacity) * 100);
    const partialAssignment = this.calculateMinimalTableAssignment(partySize, groupTables);
    
    // Use partial if it requires fewer tables and efficiency is reasonable (>70%)
    const usePartial = partialAssignment.tables.length < groupTables.length && 
                       partialAssignment.efficiency >= 70 &&
                       partialAssignment.actualCapacity >= partySize;
    
    return {
      usePartial,
      partialAssignment: usePartial ? partialAssignment : undefined,
      reason: usePartial 
        ? `Partial assignment more efficient: ${partialAssignment.tables.length}/${groupTables.length} tables (${partialAssignment.efficiency}% vs ${fullGroupEfficiency}%)`
        : `Full group needed: ${groupTables.length} tables required or partial efficiency too low`
    };
  }

  /**
   * Validate that a party size doesn't exceed available capacity
   * Prevents overbooking (e.g., 30 people on 28-seat group)
   */
  static validateCapacity(
    partySize: number,
    isFullGroup: boolean,
    group?: { max_combined_capacity: number },
    remainingTables?: Table[]
  ): {
    isValid: boolean;
    availableCapacity: number;
    message?: string;
  } {
    const availableCapacity = this.getBookingCapacity(
      isFullGroup, 
      group, 
      remainingTables
    );

    const isValid = availableCapacity >= partySize;
    
    return {
      isValid,
      availableCapacity,
      message: isValid 
        ? undefined 
        : `Party size (${partySize}) exceeds available capacity (${availableCapacity} seats)`
    };
  }
}