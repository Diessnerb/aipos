import { Reservation } from '@/types/reservation';

/**
 * Normalizes table_number and table_numbers fields to ensure consistency
 * This mirrors the transformRows logic in useUltraFastReservationsQuery
 * and ensures both fields are properly populated and typed as numbers
 */
export const normalizeReservationTableNumbers = (data: any): { 
  table_number: number | null; 
  table_numbers: number[] | null;
} => {
  // Ensure we're working with numbers, not strings
  let table_number = data.table_number ? Number(data.table_number) : null;
  let table_numbers = data.table_numbers 
    ? (Array.isArray(data.table_numbers) ? data.table_numbers.map(Number) : [Number(data.table_numbers)])
    : null;
  
  // Normalize: if table_numbers has 1 element, also set table_number
  if (table_numbers?.length === 1) {
    table_number = table_numbers[0];
  } 
  // If table_number exists but table_numbers doesn't, set table_numbers = [table_number]
  else if (table_number && (!table_numbers || table_numbers.length === 0)) {
    table_numbers = [table_number];
  }
  
  return { table_number, table_numbers };
};
