import { Table } from '@/types/table';
import { Reservation } from '@/types/reservation';

/**
 * Groups consecutive table numbers into segments for visual merging
 * Example: [1,2,5,6,7] → [[1,2], [5,6,7]]
 */
export function getReservationSegments(
  tableNumbers: number[],
  allTables: Table[]
): number[][] {
  if (!tableNumbers || tableNumbers.length <= 1) {
    return [tableNumbers || []];
  }

  // Get existing table numbers and sort them
  const existingTableNumbers = allTables
    .map(t => t.table_number)
    .sort((a, b) => a - b);

  // Filter and sort reservation tables to only include existing ones
  const validTableNumbers = tableNumbers
    .filter(num => existingTableNumbers.includes(num))
    .sort((a, b) => a - b);

  if (validTableNumbers.length === 0) {
    return [[]];
  }

  if (validTableNumbers.length === 1) {
    return [validTableNumbers];
  }

  // Group consecutive tables into segments
  const segments: number[][] = [];
  let currentSegment: number[] = [validTableNumbers[0]];

  for (let i = 1; i < validTableNumbers.length; i++) {
    const currentTable = validTableNumbers[i];
    const prevTable = validTableNumbers[i - 1];
    
    const currentIndex = existingTableNumbers.indexOf(currentTable);
    const prevIndex = existingTableNumbers.indexOf(prevTable);
    
    // Check if tables are consecutive in the existing table sequence
    if (currentIndex - prevIndex === 1) {
      // Consecutive - add to current segment
      currentSegment.push(currentTable);
    } else {
      // Not consecutive - start new segment
      segments.push(currentSegment);
      currentSegment = [currentTable];
    }
  }

  // Add the final segment
  segments.push(currentSegment);

  return segments;
}

/**
 * Determines if a reservation block should be displayed for a given table
 * Only shows blocks on the first table of each segment
 */
export function shouldShowReservationBlock(
  reservation: Reservation,
  currentTableNumber: number,
  allTables: Table[]
): boolean {
  // Single table reservations always show
  if (!reservation.table_numbers || reservation.table_numbers.length <= 1) {
    return true;
  }

  // Get segments for this reservation
  const segments = getReservationSegments(reservation.table_numbers, allTables);
  
  // Show block only if current table is the first table of any segment
  return segments.some(segment => segment.length > 0 && segment[0] === currentTableNumber);
}

/**
 * Gets the segment that contains a specific table number
 */
export function getSegmentForTable(
  tableNumbers: number[],
  targetTableNumber: number,
  allTables: Table[]
): number[] {
  const segments = getReservationSegments(tableNumbers, allTables);
  return segments.find(segment => segment.includes(targetTableNumber)) || [];
}

/**
 * Calculates the visual span (height) needed to cover all tables in a segment
 */
export function calculateSegmentSpan(
  reservation: Reservation,
  currentTableNumber: number,
  allTables: Table[],
  rowHeight: number
): { height: number; tablesInSegment: number[] } {
  if (!reservation.table_numbers || reservation.table_numbers.length <= 1) {
    return { height: rowHeight, tablesInSegment: [currentTableNumber] };
  }

  const segment = getSegmentForTable(reservation.table_numbers, currentTableNumber, allTables);
  
  if (segment.length <= 1) {
    return { height: rowHeight, tablesInSegment: segment };
  }

  // Calculate height to span all tables in the segment
  const height = segment.length * rowHeight;
  
  return { height, tablesInSegment: segment };
}