import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get safe last_visit date (returns null if the date is in the future)
 * This prevents displaying future dates as "last visit"
 */
export function getSafeLastVisit(lastVisit: string | undefined | null): string | null {
  if (!lastVisit) return null;
  const today = new Date().toISOString().split('T')[0];
  return lastVisit <= today ? lastVisit : null;
}
