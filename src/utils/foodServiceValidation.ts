import { OpeningHoursData, DayOfWeek, DAYS_OF_WEEK } from '@/types/openingHours';

/**
 * Convert HH:MM time string to minutes since midnight
 */
export function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if a time falls within food service hours for a given day
 */
export function isWithinFoodServiceHours(
  time: string,
  dayOfWeek: DayOfWeek,
  hoursData: OpeningHoursData | null
): { isWithin: boolean; reason?: string } {
  if (!hoursData?.foodService) {
    return { isWithin: true }; // No restrictions if not configured
  }

  const servicePeriods = hoursData.foodService[dayOfWeek];
  if (!servicePeriods || servicePeriods.length === 0) {
    return { isWithin: true }; // No restrictions if no periods defined
  }

  const timeMinutes = timeToMinutes(time);

  for (const period of servicePeriods) {
    const startMinutes = timeToMinutes(period.start);
    const endMinutes = timeToMinutes(period.end);

    if (timeMinutes >= startMinutes && timeMinutes <= endMinutes - 15) {
      return { isWithin: true };
    }
  }

  const periodNames = servicePeriods.map(p => p.name).join(', ');
  return { 
    isWithin: false, 
    reason: `Kitchen is only serving during: ${periodNames}` 
  };
}

/**
 * Get the day of week from a date string (YYYY-MM-DD)
 */
export function getDayOfWeekFromDate(dateString: string): DayOfWeek {
  const date = new Date(dateString + 'T12:00:00'); // Use noon to avoid timezone issues
  const dayIndex = date.getDay();
  // JavaScript getDay() returns 0 for Sunday, 1 for Monday, etc.
  const dayMap: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return dayMap[dayIndex];
}

/**
 * Validate if a reservation time is within operating hours and food service hours
 */
export function validateReservationTime(
  date: string,
  time: string,
  hoursData: OpeningHoursData | null
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!hoursData?.operating) {
    return { isValid: true, warnings };
  }

  const dayOfWeek = getDayOfWeekFromDate(date);
  const dayHours = hoursData.operating[dayOfWeek];

  // Check if restaurant is closed
  if (dayHours.closed) {
    warnings.push('Restaurant is closed on this day');
    return { isValid: false, warnings };
  }

  // Check operating hours
  const timeMinutes = timeToMinutes(time);
  const openMinutes = timeToMinutes(dayHours.open);
  let closeMinutes = timeToMinutes(dayHours.close);

  // Handle past-midnight closing
  if (closeMinutes < openMinutes) {
    closeMinutes += 24 * 60;
  }

  if (timeMinutes < openMinutes || timeMinutes > closeMinutes) {
    warnings.push(`Outside operating hours (${dayHours.open} - ${dayHours.close})`);
  }

  // Check food service hours
  const foodServiceCheck = isWithinFoodServiceHours(time, dayOfWeek, hoursData);
  if (!foodServiceCheck.isWithin && foodServiceCheck.reason) {
    warnings.push(foodServiceCheck.reason);
  }

  return { isValid: warnings.length === 0, warnings };
}
