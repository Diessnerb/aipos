
/**
 * Utility functions for handling table range calculations and consecutive table logic
 */

export interface TableRangeResult {
  tables: number[];
  isConsecutive: boolean;
  confidence: 'perfect' | 'good' | 'fallback';
  reason: string;
}

/**
 * Check if a list of table numbers are consecutive within the available tables
 */
export const areTablesConsecutive = (tableNumbers: number[], availableTables: number[]): boolean => {
  if (tableNumbers.length <= 1) return true;
  
  console.log('=== CHECKING TABLE CONSECUTIVENESS ===', {
    tableNumbers,
    availableTables: availableTables.slice(0, 10), // Log first 10 to avoid spam
    tableCount: tableNumbers.length
  });
  
  if (availableTables.length === 0) {
    console.warn('=== NO AVAILABLE TABLES - CANNOT VALIDATE CONSECUTIVENESS ===');
    return false;
  }
  
  // Use available tables to determine consecutiveness
  const existingTableNumbers = availableTables.sort((a, b) => a - b);
  const sortedReservationTables = tableNumbers
    .filter(num => existingTableNumbers.includes(num))
    .sort((a, b) => a - b);
  
  console.log('=== CONSECUTIVENESS CHECK DETAILS ===', {
    existingTableNumbers,
    sortedReservationTables,
    filteredOut: tableNumbers.filter(num => !existingTableNumbers.includes(num))
  });
  
  // Check if they form a consecutive sequence within existing tables
  for (let i = 1; i < sortedReservationTables.length; i++) {
    const currentTable = sortedReservationTables[i];
    const prevTable = sortedReservationTables[i - 1];
    
    const currentIndex = existingTableNumbers.indexOf(currentTable);
    const prevIndex = existingTableNumbers.indexOf(prevTable);
    
    console.log('=== CONSECUTIVE PAIR CHECK ===', {
      currentTable,
      prevTable,
      currentIndex,
      prevIndex,
      indexDiff: currentIndex - prevIndex,
      isConsecutive: currentIndex - prevIndex === 1
    });
    
    if (currentIndex - prevIndex !== 1) {
      console.log('=== NOT CONSECUTIVE - GAP FOUND ===');
      return false;
    }
  }
  
  const isConsecutive = true;
  console.log('=== FINAL CONSECUTIVENESS RESULT ===', {
    tableNumbers,
    isConsecutive,
    consecutiveInSystem: sortedReservationTables
  });
  
  return isConsecutive;
};

/**
 * Find the best consecutive range of tables starting from a target table
 */
export const findBestConsecutiveRange = (
  targetTable: number,
  desiredSpan: number,
  availableTables: number[]
): TableRangeResult => {
  console.log('=== FINDING BEST CONSECUTIVE RANGE ===', {
    targetTable,
    desiredSpan,
    availableTablesCount: availableTables.length,
    availableTables: availableTables.slice(0, 15) // Show first 15 for debugging
  });

  if (availableTables.length === 0) {
    return {
      tables: [targetTable],
      isConsecutive: false,
      confidence: 'fallback',
      reason: 'No available tables to validate against'
    };
  }

  const sortedTables = availableTables.sort((a, b) => a - b);
  
  // Strategy 1: Try forward from target table
  const forwardRange = [];
  let currentTable = targetTable;
  
  for (let i = 0; i < desiredSpan; i++) {
    if (sortedTables.includes(currentTable)) {
      forwardRange.push(currentTable);
      // Find the next consecutive table in the system
      const currentIndex = sortedTables.indexOf(currentTable);
      if (currentIndex < sortedTables.length - 1) {
        currentTable = sortedTables[currentIndex + 1];
      } else {
        break; // No more tables available
      }
    } else {
      break; // Table doesn't exist
    }
  }

  console.log('=== FORWARD RANGE ATTEMPT ===', {
    forwardRange,
    desiredSpan,
    achieved: forwardRange.length
  });

  if (forwardRange.length === desiredSpan) {
    return {
      tables: forwardRange,
      isConsecutive: true,
      confidence: 'perfect',
      reason: `Perfect forward consecutive range from table ${targetTable}`
    };
  }

  // Strategy 2: Try backward from target table to get desired span
  const targetIndex = sortedTables.indexOf(targetTable);
  if (targetIndex >= 0) {
    const backwardStartIndex = Math.max(0, targetIndex - desiredSpan + 1);
    const backwardRange = [];
    
    for (let i = backwardStartIndex; i <= targetIndex && backwardRange.length < desiredSpan; i++) {
      backwardRange.push(sortedTables[i]);
    }

    console.log('=== BACKWARD RANGE ATTEMPT ===', {
      targetIndex,
      backwardStartIndex,
      backwardRange,
      desiredSpan,
      achieved: backwardRange.length
    });

    if (backwardRange.length === desiredSpan && backwardRange.includes(targetTable)) {
      return {
        tables: backwardRange,
        isConsecutive: true,
        confidence: 'good',
        reason: `Backward consecutive range including table ${targetTable}`
      };
    }
  }

  // Strategy 3: Try to find any consecutive range near the target
  const nearbyRanges = [];
  for (let startIdx = Math.max(0, targetIndex - desiredSpan); 
       startIdx <= Math.min(sortedTables.length - desiredSpan, targetIndex + 1); 
       startIdx++) {
    
    const range = sortedTables.slice(startIdx, startIdx + desiredSpan);
    if (range.length === desiredSpan) {
      const distance = Math.abs(range[0] - targetTable) + Math.abs(range[range.length - 1] - targetTable);
      nearbyRanges.push({ range, distance });
    }
  }

  if (nearbyRanges.length > 0) {
    nearbyRanges.sort((a, b) => a.distance - b.distance);
    const bestNearby = nearbyRanges[0];
    
    console.log('=== NEARBY RANGE FOUND ===', {
      bestRange: bestNearby.range,
      distance: bestNearby.distance,
      targetTable
    });

    return {
      tables: bestNearby.range,
      isConsecutive: true,
      confidence: 'good',
      reason: `Nearby consecutive range (distance: ${bestNearby.distance})`
    };
  }

  // Fallback: Single table
  console.log('=== FALLBACK TO SINGLE TABLE ===', { targetTable });
  
  return {
    tables: [targetTable],
    isConsecutive: false,
    confidence: 'fallback',
    reason: `Could not find consecutive range of ${desiredSpan} tables, fallback to single table`
  };
};

/**
 * Determine the best table configuration for a moved reservation
 */
export const determineOptimalTableConfiguration = (
  currentReservation: { table_numbers?: number[] | null; table_number?: number | null },
  targetTable: number,
  availableTables: number[]
): TableRangeResult => {
  console.log('=== DETERMINING OPTIMAL TABLE CONFIGURATION ===', {
    currentReservation: {
      table_numbers: currentReservation.table_numbers,
      table_number: currentReservation.table_number
    },
    targetTable,
    availableTablesCount: availableTables.length
  });

  const isCurrentlyMultiTable = currentReservation.table_numbers && currentReservation.table_numbers.length > 1;
  
  if (isCurrentlyMultiTable) {
    const currentSpan = currentReservation.table_numbers!.length;
    const isCurrentlyConsecutive = areTablesConsecutive(currentReservation.table_numbers!, availableTables);
    
    console.log('=== MULTI-TABLE RESERVATION ANALYSIS ===', {
      currentSpan,
      isCurrentlyConsecutive,
      currentTables: currentReservation.table_numbers
    });

    // Try to maintain multi-table nature
    const rangeResult = findBestConsecutiveRange(targetTable, currentSpan, availableTables);
    
    if (rangeResult.confidence === 'perfect' || rangeResult.confidence === 'good') {
      console.log('=== MAINTAINING MULTI-TABLE CONFIGURATION ===', rangeResult);
      return rangeResult;
    }
    
    // If we can't maintain the exact span, but user clearly wants multi-table
    // Try a smaller span that includes the target
    for (let span = Math.max(2, currentSpan - 1); span >= 2; span--) {
      const smallerRangeResult = findBestConsecutiveRange(targetTable, span, availableTables);
      if (smallerRangeResult.confidence === 'perfect') {
        console.log('=== USING SMALLER MULTI-TABLE SPAN ===', {
          originalSpan: currentSpan,
          newSpan: span,
          result: smallerRangeResult
        });
        return {
          ...smallerRangeResult,
          reason: `Reduced from ${currentSpan} to ${span} tables to maintain consecutive arrangement`
        };
      }
    }
  }

  // Single table fallback
  console.log('=== SINGLE TABLE CONFIGURATION ===', { targetTable });
  return {
    tables: [targetTable],
    isConsecutive: false,
    confidence: 'fallback',
    reason: 'Single table configuration'
  };
};
