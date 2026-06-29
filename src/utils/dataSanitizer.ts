/**
 * Data Sanitization for Pre-Authentication Display
 * 
 * Masks sensitive customer information while preserving
 * structural data needed for UI rendering
 */

import { Reservation } from '@/types/reservation';

/**
 * Sanitize a single reservation for pre-auth display
 * Masks customer-identifying information while keeping structural data
 */
export function sanitizeReservation(reservation: Reservation): Reservation {
  return {
    ...reservation,
    customer_name: 'Guest',
    phone: '',
    email: '',
    notes: reservation.notes ? '•••' : undefined,
    allergens: reservation.has_allergens ? ['•••'] : undefined,
  };
}

/**
 * Sanitize an array of reservations
 */
export function sanitizeReservations(reservations: Reservation[]): Reservation[] {
  return reservations.map(sanitizeReservation);
}

/**
 * Check if data is in sanitized (pre-auth) mode
 */
export function isSanitizedReservation(reservation: Reservation): boolean {
  return reservation.customer_name === 'Guest';
}

/**
 * Merge full reservation data into sanitized reservation
 * Used when unmasking after PIN login
 */
export function unmaskReservation(sanitized: Reservation, full: Reservation): Reservation {
  return {
    ...sanitized,
    customer_name: full.customer_name,
    phone: full.phone,
    email: full.email,
    notes: full.notes,
    allergens: full.allergens,
    has_allergens: full.has_allergens,
  };
}
