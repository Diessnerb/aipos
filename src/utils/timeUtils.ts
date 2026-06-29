/**
 * Gets the next 15-minute time slot from the current time
 * @returns Time string in HH:MM format rounded UP to the next 15-minute interval
 */
export const getNextFifteenMinuteSlot = (): string => {
  const now = new Date();
  const minutes = now.getMinutes();
  const remainder = minutes % 15;
  
  let roundedMinutes;
  if (remainder === 0) {
    // Already on a 15-minute interval, use current time
    roundedMinutes = minutes;
  } else {
    // Round up to next 15-minute interval
    roundedMinutes = minutes + (15 - remainder);
  }
  
  now.setMinutes(roundedMinutes, 0, 0);
  
  // Return in HH:MM format
  return now.toTimeString().slice(0, 5);
};

/**
 * Rounds current time DOWN to the last 15-minute interval
 * Used when marking reservations as completed to capture actual end time
 * @returns Time string in HH:MM format rounded DOWN to the last 15-minute interval
 */
export const roundToLast15Minutes = (): string => {
  const now = new Date();
  const minutes = now.getMinutes();
  const remainder = minutes % 15;
  
  // Round down to last 15-minute interval
  const roundedMinutes = minutes - remainder;
  
  now.setMinutes(roundedMinutes, 0, 0);
  
  // Return in HH:MM format
  return now.toTimeString().slice(0, 5);
};

/**
 * Gets the minimum pickup time (current time + 45 minutes)
 * Rounded to the next 15-minute interval
 * @returns Date object set to 45 minutes from now, rounded to next 15-min slot
 */
export const getMinimumPickupTime = (): Date => {
  const now = new Date();
  const minTime = new Date(now.getTime() + 45 * 60000); // Add 45 minutes
  
  const minutes = minTime.getMinutes();
  const remainder = minutes % 15;
  
  // Round up to next 15-minute interval
  const roundedMinutes = remainder === 0 ? minutes : minutes + (15 - remainder);
  
  minTime.setMinutes(roundedMinutes, 0, 0);
  
  return minTime;
};