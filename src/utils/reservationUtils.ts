import { Reservation } from '@/types/reservation';

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    case 'completed': return 'bg-blue-100 text-blue-800';
    case 'seated': return 'bg-blue-100 text-blue-800';
    case 'no-show': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const isReservationStartTimePast = (date: string, time?: string) => {
  // Get today's date in YYYY-MM-DD format in local timezone
  const today = new Date();
  const todayString = today.getFullYear() + '-' + 
    String(today.getMonth() + 1).padStart(2, '0') + '-' + 
    String(today.getDate()).padStart(2, '0');
  
  // Date is before today
  if (date < todayString) return true;
  
  // Date is after today
  if (date > todayString) return false;
  
  // Date is today - check if start time has passed
  if (date === todayString && time) {
    const [hours, minutes] = time.split(':').map(Number);
    const reservationTime = hours * 60 + minutes;
    const currentTime = today.getHours() * 60 + today.getMinutes();
    
    // No buffer - check if start time has passed
    return reservationTime < currentTime;
  }
  
  // If no time provided and date is today, consider it not in past
  return false;
};

export const isReservationEndTimePast = (date: string, time?: string, endTime?: string) => {
  // Get today's date in YYYY-MM-DD format in local timezone
  const today = new Date();
  const todayString = today.getFullYear() + '-' + 
    String(today.getMonth() + 1).padStart(2, '0') + '-' + 
    String(today.getDate()).padStart(2, '0');
  
  // Date is before today
  if (date < todayString) return true;
  
  // Date is after today
  if (date > todayString) return false;
  
  // Date is today - check if end time has passed
  if (date === todayString && time) {
    let calculatedEndTime: string;
    
    if (endTime) {
      calculatedEndTime = endTime;
    } else {
      // Calculate end time as start time + 2 hours (120 minutes)
      const [hours, minutes] = time.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + 120;
      const endHours = Math.floor(totalMinutes / 60);
      const endMinutes = totalMinutes % 60;
      calculatedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    }
    
    const [endHours, endMinutes] = calculatedEndTime.split(':').map(Number);
    const endTimeInMinutes = endHours * 60 + endMinutes;
    const currentTime = today.getHours() * 60 + today.getMinutes();
    
    return endTimeInMinutes < currentTime;
  }
  
  // If no time provided and date is today, consider it not past
  return false;
};

export const isReservationInPast = (date: string, time?: string) => {
  // Get today's date in YYYY-MM-DD format in local timezone
  const today = new Date();
  const todayString = today.getFullYear() + '-' + 
    String(today.getMonth() + 1).padStart(2, '0') + '-' + 
    String(today.getDate()).padStart(2, '0');
  
  // Debug logging gated behind debug config
  if (process.env.NODE_ENV === 'development') {
    console.log('=== DEBUG: Date comparison ===');
    console.log('Reservation date:', date);
    console.log('Today date string:', todayString);
    console.log('Date type:', typeof date);
    console.log('Today type:', typeof todayString);
    console.log('Is in past (date < todayString):', date < todayString);
    console.log('Is same date (date === todayString):', date === todayString);
    console.log('Is future (date > todayString):', date > todayString);
  }
  
  // Date is before today
  if (date < todayString) return true;
  
  // Date is after today
  if (date > todayString) return false;
  
  // Date is today - check time if provided
  if (date === todayString && time) {
    const [hours, minutes] = time.split(':').map(Number);
    const reservationTime = hours * 60 + minutes;
    const currentTime = today.getHours() * 60 + today.getMinutes();
    
    // Add 2-hour buffer (reservation duration) - if reservation ended, it's in the past
    return (reservationTime + 120) < currentTime;
  }
  
  // If no time provided and date is today, consider it not in past
  return false;
};

export const shouldShowPastDateAlert = (reservation: Reservation, filterStatus: string) => {
  return filterStatus === 'upcoming' && isReservationInPast(reservation.date);
};

export const getTableDisplay = (reservation: Reservation) => {
  if (reservation.table_numbers && reservation.table_numbers.length > 1) {
    return reservation.table_numbers.join(', ');
  }
  return reservation.table_number ? reservation.table_number.toString() : '-';
};

export const filterReservations = (reservations: Reservation[], filterStatus: string) => {
  // Debug logging gated behind development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('=== DEBUG: Filtering reservations ===');
    console.log('Filter status:', filterStatus);
    console.log('Total reservations:', reservations.length);
    console.log('All reservation dates:', reservations.map(r => ({ name: r.customer_name, date: r.date, status: r.status })));
  }
  
  let filtered: Reservation[];
  
  switch (filterStatus) {
    case 'upcoming':
      // Show ALL reservations that are today or in the future, regardless of status
      // This includes confirmed, pending, and any other status as long as it's not in the past
      filtered = reservations.filter(r => {
        const isNotInPast = !isReservationInPast(r.date);
        if (process.env.NODE_ENV === 'development') {
          console.log(`=== Individual reservation check ===`);
          console.log(`Reservation: ${r.customer_name}`);
          console.log(`Date: ${r.date}`);
          console.log(`Status: ${r.status}`);
          console.log(`Is not in past: ${isNotInPast}`);
          console.log(`Will be included: ${isNotInPast}`);
        }
        return isNotInPast;
      });
      break;
    case 'unassigned':
      // Show reservations without table assignments
      filtered = reservations.filter(r => 
        !r.table_number &&
        (!r.table_numbers || r.table_numbers.length === 0) &&
        r.status !== 'cancelled' &&
        r.status !== 'no-show' &&
        r.status !== 'completed'
      );
      break;
    case 'all':
      filtered = reservations;
      break;
    case 'cancelled':
      filtered = reservations.filter(r => r.status === 'cancelled');
      break;
    case 'completed':
      filtered = reservations.filter(r => r.status === 'completed');
      break;
    case 'seated':
      filtered = reservations.filter(r => r.status === 'seated');
      break;
    case 'no-show':
      filtered = reservations.filter(r => r.status === 'no-show');
      break;
    default:
      filtered = reservations.filter(r => r.status === filterStatus);
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log('=== Final filter results ===');
    console.log('Filtered reservations count:', filtered.length);
    console.log('Filtered reservation details:', filtered.map(r => ({ name: r.customer_name, date: r.date, status: r.status })));
  }
  return filtered;
};

export const sortReservations = (reservations: Reservation[]) => {
  return reservations.sort((a, b) => {
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayString = today.getFullYear() + '-' + 
      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
      String(today.getDate()).padStart(2, '0');
    
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    const dateA = a.date;
    const dateB = b.date;
    
    const isAToday = dateA === todayString;
    const isBToday = dateB === todayString;
    
    // Prioritize today's reservations
    if (isAToday && !isBToday) return -1;
    if (!isAToday && isBToday) return 1;
    
    // If both are today, sort by proximity to current time
    if (isAToday && isBToday) {
      const timeA = a.time.split(':');
      const timeB = b.time.split(':');
      const timeAInMinutes = parseInt(timeA[0]) * 60 + parseInt(timeA[1]);
      const timeBInMinutes = parseInt(timeB[0]) * 60 + parseInt(timeB[1]);
      
      // Prioritize upcoming reservations, then past ones
      if (timeAInMinutes >= currentTimeInMinutes && timeBInMinutes >= currentTimeInMinutes) {
        return timeAInMinutes - timeBInMinutes;
      }
      
      if (timeAInMinutes < currentTimeInMinutes && timeBInMinutes < currentTimeInMinutes) {
        return timeBInMinutes - timeAInMinutes;
      }
      
      if (timeAInMinutes >= currentTimeInMinutes && timeBInMinutes < currentTimeInMinutes) {
        return -1;
      }
      if (timeBInMinutes >= currentTimeInMinutes && timeAInMinutes < currentTimeInMinutes) {
        return 1;
      }
    }
    
    // For different dates, sort by date (most recent first)
    if (dateA !== dateB) {
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    }
    
    // Same date, sort by time (latest first)
    const timeA = new Date(`${dateA} ${a.time}`).getTime();
    const timeB = new Date(`${dateB} ${b.time}`).getTime();
    return timeB - timeA;
  });
};
