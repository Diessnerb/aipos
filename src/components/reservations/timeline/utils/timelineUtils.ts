// Generate time slots with 15-minute intervals based on opening hours
export const generateTimeSlots = (openingHour: number, closingHour: number) => {
  const slots: any[] = [];
  
  // Validate inputs
  if (!Number.isFinite(openingHour) || !Number.isFinite(closingHour)) {
    console.warn('Invalid opening/closing hours:', { openingHour, closingHour });
    return slots;
  }
  
  // Ensure reasonable bounds for opening hour
  const safeOpeningHour = Math.max(0, Math.min(23, Math.floor(openingHour)));
  // Clamp closing hour at 24 for current day (past-midnight slots will appear on next day)
  const clampedClosingHour = Math.min(24, Math.floor(closingHour));
  const safeClosingHour = Math.max(safeOpeningHour + 1, clampedClosingHour);
  
  console.log('Generating time slots:', { 
    originalOpening: openingHour,
    originalClosing: closingHour,
    safeOpeningHour, 
    clampedClosing: clampedClosingHour,
    safeClosingHour,
    totalSlots: ((safeClosingHour - safeOpeningHour) * 4)
  });
  
  // Generate 15-minute intervals
  for (let hour = safeOpeningHour; hour < safeClosingHour; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const totalMinutes = hour * 60 + minute;
      const closingMinutes = safeClosingHour * 60;
      
      // Stop if we've reached closing time (exclusive)
      if (totalMinutes >= closingMinutes) {
        break;
      }
      
      // Format time string (HH:MM)
      const hourStr = hour.toString().padStart(2, '0');
      const minuteStr = minute.toString().padStart(2, '0');
      const timeStr = `${hourStr}:${minuteStr}`;
      const isMainHour = minute === 0;
      
      slots.push({
        hour,
        minute,
        time: timeStr,
        isMainHour,
        label: isMainHour ? timeStr : '',
        isPastMidnight: false // Never true since we clamp at 24
      });
    }
  }
  
  console.log(`Generated ${slots.length} time slots from ${safeOpeningHour}:00 to ${safeClosingHour}:00 (${(safeClosingHour - safeOpeningHour)} hours x 4 slots)`);
  
  return slots;
};

export const timeToMinutes = (timeString: string) => {
  if (!timeString || typeof timeString !== 'string') {
    console.log('Invalid time string:', timeString);
    return 0;
  }
  const [hours, minutes] = timeString.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    console.log('Invalid time format:', timeString);
    return 0;
  }
  return hours * 60 + minutes;
};

// Parse Tailwind color classes from StatusConfigContext to timeline format
const parseStatusColorForTimeline = (colorClasses: string): { borderColor: string; textColor: string } => {
  // Extract colors from classes like "bg-green-500 text-white border-green-500"
  const borderMatch = colorClasses.match(/border-(\w+-\d+)/);
  const textMatch = colorClasses.match(/text-(\w+-\d+)/);
  
  // Default to a lighter border and darker text for timeline blocks
  let borderColor = 'border-gray-300';
  let textColor = 'text-gray-800';
  
  if (borderMatch) {
    const [color, shade] = borderMatch[1].split('-');
    // Use lighter shade for border (300) to maintain timeline aesthetic
    borderColor = `border-${color}-300`;
  }
  
  if (textMatch) {
    const [color, shade] = textMatch[1].split('-');
    // Use darker shade for text (800) for better contrast on white background
    textColor = `text-${color}-800`;
  }
  
  return { borderColor, textColor };
};

export const getStatusColor = (status: string, statusConfig?: Record<string, { label: string; color: string }>) => {
  // Use dynamic colors from context if available
  if (statusConfig && statusConfig[status]) {
    const { borderColor, textColor } = parseStatusColorForTimeline(statusConfig[status].color);
    return `bg-white ${borderColor} ${textColor}`;
  }
  
  // Fallback to hardcoded colors
  switch (status) {
    case 'confirmed': return 'bg-white border-green-300 text-green-800';
    case 'seated': return 'bg-white border-orange-300 text-orange-800';
    case 'pending': return 'bg-white border-yellow-300 text-yellow-800';
    case 'cancelled': return 'bg-white border-red-300 text-red-800';
    case 'completed': return 'bg-white border-blue-300 text-blue-800';
    case 'no-show': return 'bg-white border-gray-300 text-gray-800';
    case 'late': return 'bg-white border-yellow-300 text-yellow-800';
    case 'waiting-for-order': return 'bg-white border-fuchsia-300 text-fuchsia-800';
    case 'waiting-for-starters': return 'bg-white border-green-300 text-green-800';
    case 'starters-ready-in-kitchen': return 'bg-white border-blue-300 text-blue-800';
    case 'starters-served': return 'bg-white border-green-300 text-green-800';
    case 'requires-check-back-on-starters': return 'bg-white border-fuchsia-300 text-fuchsia-800';
    case 'eating-starters': return 'bg-white border-green-300 text-green-800';
    case 'clear-starters': return 'bg-white border-fuchsia-300 text-fuchsia-800';
    case 'waiting-for-mains': return 'bg-white border-green-300 text-green-800';
    case 'mains-ready-in-kitchen': return 'bg-white border-blue-300 text-blue-800';
    case 'mains-served': return 'bg-white border-green-300 text-green-800';
    case 'requires-check-back-on-mains': return 'bg-white border-fuchsia-300 text-fuchsia-800';
    case 'eating-mains': return 'bg-white border-green-300 text-green-800';
    case 'clear-mains': return 'bg-white border-fuchsia-300 text-fuchsia-800';
    case 'waiting-for-desserts': return 'bg-white border-green-300 text-green-800';
    case 'desserts-ready-in-kitchen': return 'bg-white border-blue-300 text-blue-800';
    case 'desserts-served': return 'bg-white border-green-300 text-green-800';
    case 'requires-check-back-on-desserts': return 'bg-white border-fuchsia-300 text-fuchsia-800';
    case 'eating-dessert': return 'bg-white border-green-300 text-green-800';
    case 'clear-desserts': return 'bg-white border-fuchsia-300 text-fuchsia-800';
    case 'table-cleared': return 'bg-white border-green-300 text-green-800';
    case 'bill-requested-waiting-to-pay': return 'bg-white border-fuchsia-300 text-fuchsia-800';
    case 'table-complete': return 'bg-white border-green-300 text-green-800';
    default: return 'bg-white border-gray-300 text-gray-800';
  }
};

export const getStatusLeftBorderColor = (status: string, statusConfig?: Record<string, { label: string; color: string }>) => {
  // Use dynamic colors from context if available
  if (statusConfig && statusConfig[status]) {
    const borderMatch = statusConfig[status].color.match(/border-(\w+-\d+)/);
    if (borderMatch) {
      const [color, shade] = borderMatch[1].split('-');
      // Use darker shade for left border (500) for emphasis
      return `border-l-${color}-500`;
    }
  }
  
  // Fallback to hardcoded colors
  switch (status) {
    case 'confirmed': return 'border-l-green-500';
    case 'seated': return 'border-l-orange-500';
    case 'pending': return 'border-l-yellow-500';
    case 'cancelled': return 'border-l-red-500';
    case 'completed': return 'border-l-blue-500';
    case 'no-show': return 'border-l-gray-500';
    case 'late': return 'border-l-yellow-500';
    case 'waiting-for-order': return 'border-l-fuchsia-500';
    case 'waiting-for-starters': return 'border-l-green-500';
    case 'starters-ready-in-kitchen': return 'border-l-blue-500';
    case 'starters-served': return 'border-l-green-500';
    case 'requires-check-back-on-starters': return 'border-l-fuchsia-500';
    case 'eating-starters': return 'border-l-green-500';
    case 'clear-starters': return 'border-l-fuchsia-500';
    case 'waiting-for-mains': return 'border-l-green-500';
    case 'mains-ready-in-kitchen': return 'border-l-blue-500';
    case 'mains-served': return 'border-l-green-500';
    case 'requires-check-back-on-mains': return 'border-l-fuchsia-500';
    case 'eating-mains': return 'border-l-green-500';
    case 'clear-mains': return 'border-l-fuchsia-500';
    case 'waiting-for-desserts': return 'border-l-green-500';
    case 'desserts-ready-in-kitchen': return 'border-l-blue-500';
    case 'desserts-served': return 'border-l-green-500';
    case 'requires-check-back-on-desserts': return 'border-l-fuchsia-500';
    case 'eating-dessert': return 'border-l-green-500';
    case 'clear-desserts': return 'border-l-fuchsia-500';
    case 'table-cleared': return 'border-l-green-500';
    case 'bill-requested-waiting-to-pay': return 'border-l-fuchsia-500';
    case 'table-complete': return 'border-l-green-500';
    default: return 'border-l-gray-500';
  }
};

export const formatDisplayDate = (dateString: string) => {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};
