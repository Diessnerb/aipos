import { Reservation } from '@/types/reservation';
import { formatCustomerName } from '@/utils/nameUtils';

export const formatTimeWithoutSeconds = (time: string) => {
  if (!time) return '';
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return time;
};

export const calculateEndTime = (startTime: string) => {
  if (!startTime) return '';
  const parts = startTime.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const endHours = hours + 2;
    const endMinutes = minutes;
    
    const formattedEndHours = endHours.toString().padStart(2, '0');
    const formattedEndMinutes = endMinutes.toString().padStart(2, '0');
    
    return `${formattedEndHours}:${formattedEndMinutes}`;
  }
  return startTime;
};

export const getTableDisplay = (
  reservation: { table_numbers?: number[] | null; table_number?: number | null },
  availableTables: number[] = []
): string => {
  // Prioritize table_numbers when available (including single table)
  if (reservation.table_numbers && reservation.table_numbers.length >= 1) {
    const sortedTables = [...reservation.table_numbers].sort((a, b) => a - b);
    
    // For single table, just return the number
    if (sortedTables.length === 1) {
      return `${sortedTables[0]}`;
    }
    
    // For multiple tables, check if consecutive
    const sortedAvailable = [...availableTables].sort((a, b) => a - b);
    const areConsecutive = sortedTables.every((table, index) => {
      if (index === 0) return true;
      const prevTable = sortedTables[index - 1];
      const prevIndex = sortedAvailable.indexOf(prevTable);
      const currentIndex = sortedAvailable.indexOf(table);
      return currentIndex === prevIndex + 1;
    });
    
    if (areConsecutive && sortedTables.length > 1) {
      return `${sortedTables[0]}-${sortedTables[sortedTables.length - 1]}`;
    } else {
      return sortedTables.join(', ');
    }
  } else {
    // Fallback to table_number
    return `${reservation.table_number || ''}`;
  }
};

export const getTotalSeats = (
  reservation: { table_numbers?: number[] | null; table_number?: number | null },
  tables: Array<{ number: number; seats: number }> = []
): number => {
  // Prioritize table_numbers when available (including single table)
  if (reservation.table_numbers && reservation.table_numbers.length >= 1) {
    return reservation.table_numbers.reduce((total, tableNum) => {
      const table = tables.find(t => t.number === tableNum);
      return total + (table ? table.seats : 0);
    }, 0);
  } else {
    // Fallback to table_number
    const table = tables.find(t => t.number === reservation.table_number);
    return table ? table.seats : 0;
  }
};

export const exceedsCapacity = (
  reservation: { party_size?: number; table_numbers?: number[] | null; table_number?: number | null },
  tables: Array<{ number: number; seats: number }> = []
): boolean => {
  if (!reservation.party_size) return false;
  const totalSeats = getTotalSeats(reservation, tables);
  return totalSeats > 0 && reservation.party_size > totalSeats;
};

export const getReservationTextContent = (
  reservation: Reservation,
  availableTables: number[] = [],
  isMultiTable: boolean = false
): { mainText: string; timeText?: string; tableText?: string } => {
  const startTime = formatTimeWithoutSeconds(reservation.time);
  const endTime = calculateEndTime(reservation.time);
  const customerName = formatCustomerName(reservation.customer_name);
  const tableDisplay = getTableDisplay(reservation, availableTables);

  if (isMultiTable) {
    // Multi-table: three lines
    return {
      mainText: `${customerName} (${reservation.party_size})`,
      timeText: `${startTime} - ${endTime}`,
      tableText: `Tables ${tableDisplay}`
    };
  } else {
    // Single table: one line
    return {
      mainText: `${customerName} (${reservation.party_size}) - Table ${tableDisplay}`
    };
  }
};

export const createReservationDragElement = (
  reservation: Reservation,
  originalElement: HTMLElement,
  statusClasses: string,
  availableTables: number[] = [],
  tables: Array<{ number: number; seats: number }> = []
): HTMLElement => {
  const dragElement = document.createElement('div');
  
  const originalRect = originalElement.getBoundingClientRect();
  const originalStyles = window.getComputedStyle(originalElement);
  
  const isMultiTable = reservation.table_numbers && reservation.table_numbers.length > 1;
  const textContent = getReservationTextContent(reservation, availableTables, isMultiTable);
  const needsCapacityIcon = exceedsCapacity(reservation, tables);
  const hasAllergens = reservation.notes?.toLowerCase().includes('allerg');

  dragElement.className = 'fixed pointer-events-none transition-all duration-200 ease-out shadow-2xl border rounded text-xs font-medium flex flex-col justify-center group';
  dragElement.className += ` ${statusClasses}`;
  
  dragElement.style.cssText = `
    width: ${originalRect.width}px;
    height: ${originalRect.height}px;
    font-size: ${originalStyles.fontSize};
    padding: ${originalStyles.padding};
    line-height: ${originalStyles.lineHeight};
    z-index: 9999;
    box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 0 2px rgba(59, 130, 246, 0.5);
    backdrop-filter: blur(1px);
    border-width: 2px;
    animation: dragPulse 2s infinite;
  `;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'font-medium flex items-start gap-1 w-full h-full';
  
  // Icons container
  const iconsDiv = document.createElement('div');
  iconsDiv.className = 'flex flex-col gap-1 mt-0.5';
  
  // Add capacity icon if needed
  if (needsCapacityIcon) {
    const capacityIcon = document.createElement('div');
    capacityIcon.innerHTML = `<svg class="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H9v-7H1v7s0 1 1 1h18s1 0 1-1V7z"/></svg>`;
    iconsDiv.appendChild(capacityIcon);
  }
  
  // Add allergen icon if needed
  if (hasAllergens) {
    const allergenIcon = document.createElement('div');
    allergenIcon.innerHTML = `<svg class="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`;
    iconsDiv.appendChild(allergenIcon);
  }
  
  // Text container
  const textDiv = document.createElement('div');
  textDiv.className = 'flex-1 flex flex-col justify-start h-full min-h-0';
  
  if (isMultiTable) {
    // Multi-table layout: 3 lines
    const nameDiv = document.createElement('div');
    nameDiv.className = 'font-medium text-left leading-tight';
    nameDiv.textContent = textContent.mainText;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'font-semibold text-left leading-tight';
    timeDiv.textContent = textContent.timeText || '';
    
    const tableDiv = document.createElement('div');
    tableDiv.className = 'font-medium text-left leading-tight';
    tableDiv.textContent = textContent.tableText || '';
    
    textDiv.appendChild(nameDiv);
    textDiv.appendChild(timeDiv);
    textDiv.appendChild(tableDiv);
  } else {
    // Single table layout: 1 line
    const singleLineDiv = document.createElement('div');
    singleLineDiv.className = 'font-medium text-left leading-tight';
    singleLineDiv.textContent = textContent.mainText;
    
    textDiv.appendChild(singleLineDiv);
  }
  
  contentDiv.appendChild(textDiv);
  
  // Only add icons if there are any
  if (iconsDiv.children.length > 0) {
    contentDiv.appendChild(iconsDiv);
  }
  
  dragElement.appendChild(contentDiv);
  
  // Add animation styles if not already present
  if (!document.getElementById('drag-animations')) {
    const style = document.createElement('style');
    style.id = 'drag-animations';
    style.textContent = `
      @keyframes dragPulse {
        0%, 100% { box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 0 2px rgba(59, 130, 246, 0.5); }
        50% { box-shadow: 0 25px 50px rgba(0,0,0,0.4), 0 0 0 3px rgba(59, 130, 246, 0.7); }
      }
    `;
    document.head.appendChild(style);
  }
  
  dragElement.style.left = '0px';
  dragElement.style.top = '0px';
  
  document.body.appendChild(dragElement);
  return dragElement;
};