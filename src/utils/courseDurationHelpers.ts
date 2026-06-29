/**
 * Get the duration in minutes for a course based on party size
 */
export const getCourseDuration = (
  course: 'starters' | 'mains' | 'desserts',
  partySize: number
): number => {
  if (course === 'starters') {
    if (partySize <= 4) return 11; // 10-12 min range, using midpoint
    if (partySize <= 8) return 16; // 13-16 min range, using max
    return 20; // 9+ guests
  }
  
  if (course === 'mains') {
    if (partySize <= 4) return 20;
    if (partySize <= 8) return 25;
    return 30; // 9+ guests
  }
  
  // desserts
  if (partySize <= 4) return 8;
  if (partySize <= 8) return 11;
  return 15; // 9+ guests
};

/**
 * Get the clear status for a course
 */
export const getClearStatusForCourse = (
  course: 'starters' | 'mains' | 'desserts'
): string => {
  return `clear-${course}`;
};

/**
 * Get the next course status after clearing
 */
export const getNextCourseStatus = (
  course: 'starters' | 'mains' | 'desserts'
): string => {
  if (course === 'starters') return 'waiting-for-mains';
  if (course === 'mains') return 'waiting-for-desserts';
  return 'table-cleared';
};

/**
 * Get the eating status for a course
 */
export const getEatingStatusForCourse = (
  course: 'starters' | 'mains' | 'desserts'
): string => {
  if (course === 'starters') return 'eating-starters';
  if (course === 'mains') return 'eating-mains';
  return 'eating-dessert';
};

/**
 * Get the served_at timestamp field for a course
 */
export const getServedAtFieldForCourse = (
  course: 'starters' | 'mains' | 'desserts'
): string => {
  return `${course}_served_at`;
};
