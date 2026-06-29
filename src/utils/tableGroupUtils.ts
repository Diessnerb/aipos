/**
 * Table Group Management Utilities
 * Replaces consecutive table logic with proper table group validation
 */

import { TableGroupWithTables } from '@/types/table';

/**
 * Find all table groups that contain a specific table
 */
export function findTableGroupsContaining(
  tableNumber: number, 
  tableGroups: TableGroupWithTables[]
): TableGroupWithTables[] {
  return tableGroups.filter(group => 
    group.table_numbers && group.table_numbers.includes(tableNumber)
  );
}

/**
 * Validate if tables can be assigned together (must be in same group or single table)
 * Also checks for out_of_service tables
 */
export function isValidTableCombination(
  tableNumbers: number[], 
  tableGroups: TableGroupWithTables[],
  outOfServiceTables: number[] = []
): { valid: boolean; reason: string; group?: TableGroupWithTables } {
  if (tableNumbers.length <= 1) {
    return { valid: true, reason: 'Single table assignment is always valid' };
  }

  if (tableNumbers.length === 0) {
    return { valid: false, reason: 'No tables specified' };
  }

  // Check if any tables are out of service
  const outOfServiceInSelection = tableNumbers.filter(t => outOfServiceTables.includes(t));
  if (outOfServiceInSelection.length > 0) {
    return {
      valid: false,
      reason: `Table${outOfServiceInSelection.length > 1 ? 's' : ''} ${outOfServiceInSelection.join(', ')} ${outOfServiceInSelection.length > 1 ? 'are' : 'is'} out of service`
    };
  }

  let foundGroupButNotContiguous: TableGroupWithTables | undefined;

  // For multi-table assignments, all tables must be in the same group AND be adjacent in that group's order
  for (const group of tableGroups) {
    if (!group.table_numbers || group.table_numbers.length === 0) continue;
    const allTablesInThisGroup = tableNumbers.every(table => group.table_numbers!.includes(table));

    if (allTablesInThisGroup) {
      if (areTablesContiguousInGroup(tableNumbers, group)) {
        return {
          valid: true,
          reason: `Tables are adjacent within group "${group.group_name}"`,
          group
        };
      } else {
        foundGroupButNotContiguous = group;
      }
    }
  }

  if (foundGroupButNotContiguous) {
    return {
      valid: false,
      reason: `Tables ${tableNumbers.join(', ')} are not adjacent in group "${foundGroupButNotContiguous.group_name}"`
    };
  }

  return {
    valid: false,
    reason: `Tables ${tableNumbers.join(', ')} cannot be combined - they are not all in the same table group`
  };
}

/**
 * Find the best table group assignment for a party size and target table
 */
export function findOptimalGroupAssignment(
  targetTable: number,
  partySize: number,
  tableGroups: TableGroupWithTables[]
): {
  tables: number[];
  groupName?: string;
  capacity?: number;
  reason: string;
  isGroup: boolean;
} {
  const containingGroups = findTableGroupsContaining(targetTable, tableGroups);
  
  if (containingGroups.length === 0) {
    return {
      tables: [targetTable],
      reason: 'Target table is not in any group - using single table',
      isGroup: false
    };
  }

  // Filter groups that can accommodate the party size
  const suitableGroups = containingGroups.filter(group => 
    group.max_combined_capacity && group.max_combined_capacity >= partySize
  );

  if (suitableGroups.length === 0) {
    return {
      tables: [targetTable],
      reason: 'No table groups have sufficient capacity - using single table',
      isGroup: false
    };
  }

  // Sort by efficiency (least waste)
  suitableGroups.sort((a, b) => {
    const wasteA = (a.max_combined_capacity || 0) - partySize;
    const wasteB = (b.max_combined_capacity || 0) - partySize;
    return wasteA - wasteB;
  });

  const bestGroup = suitableGroups[0];
  return {
    tables: bestGroup.table_numbers || [targetTable],
    groupName: bestGroup.group_name,
    capacity: bestGroup.max_combined_capacity,
    reason: `Using table group "${bestGroup.group_name}" (${bestGroup.max_combined_capacity} available seats)`,
    isGroup: true
  };
}

/**
 * Get all tables that are NOT in any table group (standalone tables)
 */
export function getStandaloneTables(
  allTables: { table_number: number }[],
  tableGroups: TableGroupWithTables[]
): number[] {
  const tablesInGroups = new Set<number>();
  
  tableGroups.forEach(group => {
    if (group.table_numbers) {
      group.table_numbers.forEach(tableNum => tablesInGroups.add(tableNum));
    }
  });

  return allTables
    .map(table => table.table_number)
    .filter(tableNum => !tablesInGroups.has(tableNum));
}

/**
 * Find the globally optimal table assignment across ALL table groups
 * Evaluates every group and returns the most efficient combination
 */
export function findGlobalOptimalAssignment(
  partySize: number,
  tableGroups: TableGroupWithTables[],
  availableTables: { table_number: number; seats: number }[] = []
): {
  tables: number[];
  groupName?: string;
  reason: string;
  isPartial: boolean;
  actualCapacity: number;
} {
  if (tableGroups.length === 0) {
    return {
      tables: [],
      reason: 'No table groups available',
      isPartial: false,
      actualCapacity: 0
    };
  }

  const seatMap = new Map<number, number>(availableTables.map(t => [t.table_number, t.seats]));
  const allCandidates: Array<{
    tables: number[];
    groupName: string;
    capacity: number;
    waste: number;
    tableCount: number;
    efficiency: number;
    isPartial: boolean;
  }> = [];

  // Evaluate all contiguous combinations from every group
  for (const group of tableGroups) {
    if (!group.table_numbers || group.table_numbers.length === 0) continue;
    
    const order = group.table_numbers;
    
    // Evaluate all contiguous windows within this group
    for (let size = 1; size <= order.length; size++) {
      for (let start = 0; start + size <= order.length; start++) {
        const slice = order.slice(start, start + size);
        const capacity = slice.reduce((sum, tn) => sum + (seatMap.get(tn) ?? 0), 0);
        
        if (capacity >= partySize) {
          const waste = capacity - partySize;
          const efficiency = (partySize / capacity) * 100;
          
          allCandidates.push({
            tables: slice,
            groupName: group.group_name,
            capacity,
            waste,
            tableCount: slice.length,
            efficiency,
            isPartial: slice.length < order.length
          });
        }
      }
    }
  }

  if (allCandidates.length === 0) {
    return {
      tables: [],
      reason: 'No suitable table combinations found',
      isPartial: false,
      actualCapacity: 0
    };
  }

  // Sort by: 1) Fewest tables, 2) Least waste, 3) Highest efficiency
  allCandidates.sort((a, b) => {
    if (a.tableCount !== b.tableCount) return a.tableCount - b.tableCount;
    if (a.waste !== b.waste) return a.waste - b.waste;
    return b.efficiency - a.efficiency;
  });

  const optimal = allCandidates[0];

  return {
    tables: optimal.tables,
    groupName: optimal.groupName,
    reason: `Optimal: ${optimal.tableCount} tables from "${optimal.groupName}" (${optimal.capacity} seats, ${optimal.waste} waste, ${optimal.efficiency.toFixed(0)}% efficient)`,
    isPartial: optimal.isPartial,
    actualCapacity: optimal.capacity
  };
}

/**
 * Evaluate all groups containing a target table and return ranked options
 */
export function evaluateAllGroupsForTable(
  targetTable: number,
  partySize: number,
  tableGroups: TableGroupWithTables[],
  availableTables: { table_number: number; seats: number }[]
): Array<{
  group: TableGroupWithTables;
  assignment: { tables: number[]; capacity: number; waste: number; isPartial: boolean };
  score: number;
  strategy: 'single' | 'partial' | 'full';
}> {
  const containingGroups = findTableGroupsContaining(targetTable, tableGroups);
  const evaluations: any[] = [];

  for (const group of containingGroups) {
    if (!group.table_numbers || group.table_numbers.length === 0) continue;

    const tablesWithSeats = group.table_numbers.map(tableNum => ({
      table_number: tableNum,
      seats: availableTables.find(t => t.table_number === tableNum)?.seats || 7
    }));

    // Try optimal combination from anchor
    const optimalCombination = findOptimalTableCombinationFromAnchor(
      tablesWithSeats,
      partySize,
      targetTable,
      group
    );

    if (optimalCombination) {
      const capacity = optimalCombination.actualCapacity;
      const waste = capacity - partySize;
      const tableCount = optimalCombination.tables.length;

      // Calculate score (higher is better)
      let score = 1000;
      score += 100; // Includes target table
      score += (5 - tableCount) * 50; // Fewer tables = higher score
      score += Math.max(0, 100 - waste * 10); // Less waste = higher score
      score += (capacity > 0 ? (partySize / capacity) * 50 : 0); // Efficiency bonus

      // Penalty for using full group when partial would suffice
      if (!optimalCombination.isPartial && tableCount > 1) {
        const wasteRatio = waste / capacity;
        if (wasteRatio > 0.3) {
          score -= 100; // Large waste penalty
        }
      }

      evaluations.push({
        group,
        assignment: {
          tables: optimalCombination.tables,
          capacity: capacity,
          waste: waste,
          isPartial: optimalCombination.isPartial
        },
        score,
        strategy: optimalCombination.isPartial ? 'partial' : (tableCount === 1 ? 'single' : 'full')
      });
    }
  }

  // Sort by score (highest first)
  return evaluations.sort((a, b) => b.score - a.score);
}

/**
 * Find optimal partial table group assignment for a party size
 * Calculates minimum tables needed from a group based on individual table capacities
 * When mustIncludeTarget=false, uses global optimization across all groups
 * Prioritizes arrangements that include the anchor/target table when mustIncludeTarget=true
 */
export function findOptimalPartialGroupAssignment(
  targetTable: number,
  partySize: number,
  tableGroups: TableGroupWithTables[],
  availableTables: { table_number: number; seats: number }[] = [],
  mustIncludeTarget: boolean = true
): {
  tables: number[];
  groupName?: string;
  reason: string;
  isPartial: boolean;
  actualCapacity: number;
} {
  // Use global optimization when target table is not required
  if (!mustIncludeTarget) {
    return findGlobalOptimalAssignment(partySize, tableGroups, availableTables);
  }

  console.log('🎯 ANCHOR TABLE ASSIGNMENT', {
    anchorTable: targetTable,
    partySize,
    mustIncludeAnchor: mustIncludeTarget
  });

  const containingGroups = findTableGroupsContaining(targetTable, tableGroups);
  
  if (containingGroups.length === 0) {
    return {
      tables: [targetTable],
      reason: 'Target table is not in any group - using single table',
      isPartial: false,
      actualCapacity: availableTables.find(t => t.table_number === targetTable)?.seats || 0
    };
  }

  // NEW: Handle multi-group scenarios
  if (containingGroups.length > 1) {
    console.log('⚠️ MULTI-GROUP DETECTED', {
      anchorTable: targetTable,
      groupCount: containingGroups.length,
      groups: containingGroups.map(g => g.group_name)
    });

    const evaluations = evaluateAllGroupsForTable(targetTable, partySize, tableGroups, availableTables);
    
    if (evaluations.length > 0) {
      const bestOption = evaluations[0];
      console.log('✅ BEST GROUP SELECTED', {
        groupName: bestOption.group.group_name,
        tables: bestOption.assignment.tables,
        score: bestOption.score,
        strategy: bestOption.strategy
      });

      return {
        tables: bestOption.assignment.tables,
        groupName: bestOption.group.group_name,
        reason: `Selected "${bestOption.group.group_name}" (score: ${bestOption.score}, ${bestOption.strategy})`,
        isPartial: bestOption.assignment.isPartial,
        actualCapacity: bestOption.assignment.capacity
      };
    }
  }

  // Find the best group that contains the target table (single group logic)
  for (const group of containingGroups) {
    if (!group.table_numbers || !group.max_combined_capacity) continue;

    // If party size needs the full group, use all tables
    // ONLY apply threshold when NO manual anchor is specified (mustIncludeTarget=false means auto-assignment)
    const FULL_GROUP_THRESHOLD = 0.8; // Use full group if party size is 80% of max capacity
    if (!mustIncludeTarget && partySize >= group.max_combined_capacity * FULL_GROUP_THRESHOLD) {
      console.log('🎯 FULL GROUP FROM ANCHOR', {
        anchorTable: targetTable,
        groupName: group.group_name,
        allTables: group.table_numbers
      });
      return {
        tables: group.table_numbers,
        groupName: group.group_name,
        reason: `Using full "${group.group_name}" from anchor table ${targetTable} (${partySize} guests need ${group.max_combined_capacity} available seats)`,
        isPartial: false,
        actualCapacity: group.max_combined_capacity
      };
    }

    // Get tables with their seat counts
    const tablesWithSeats = group.table_numbers
      .map(tableNum => {
        const tableData = availableTables.find(t => t.table_number === tableNum);
        return { table_number: tableNum, seats: tableData?.seats || 7 }; // Default 7 seats
      });

    // Find the optimal combination of tables that MUST include the anchor
    const optimalCombination = findOptimalTableCombinationFromAnchor(
      tablesWithSeats,
      partySize,
      targetTable,
      group
    );
    
    if (optimalCombination) {
      console.log('🎯 OPTIMAL PARTIAL FROM ANCHOR', {
        anchorTable: targetTable,
        selectedTables: optimalCombination.tables,
        reason: optimalCombination.reason
      });
      return optimalCombination;
    }

    // If we can't accommodate with partial, return full group
    console.log('🎯 FALLBACK TO FULL GROUP', {
      anchorTable: targetTable,
      groupName: group.group_name
    });
    return {
      tables: group.table_numbers,
      groupName: group.group_name,
      reason: `Using full "${group.group_name}" from anchor ${targetTable} (partial assignment insufficient)`,
      isPartial: false,
      actualCapacity: group.max_combined_capacity
    };
  }

  // Fallback to single table
  return {
    tables: [targetTable],
    reason: 'No suitable table groups found - using single table',
    isPartial: false,
    actualCapacity: availableTables.find(t => t.table_number === targetTable)?.seats || 0
  };
}

/**
 * Find optimal table combination that MUST include the anchor table
 * Builds contiguous arrangements starting from or including the anchor
 */
function findOptimalTableCombinationFromAnchor(
  tablesWithSeats: { table_number: number; seats: number }[],
  partySize: number,
  anchorTable: number,
  group: TableGroupWithTables
): {
  tables: number[];
  groupName?: string;
  reason: string;
  isPartial: boolean;
  actualCapacity: number;
} | null {
  // Find anchor position in group's table order
  const anchorIndex = group.table_numbers.indexOf(anchorTable);
  if (anchorIndex === -1) {
    console.log('⚠️ ANCHOR NOT IN GROUP', { anchorTable, groupTables: group.table_numbers });
    return null;
  }

  const sortedTables = tablesWithSeats.sort((a, b) => {
    const aIdx = group.table_numbers.indexOf(a.table_number);
    const bIdx = group.table_numbers.indexOf(b.table_number);
    return aIdx - bIdx;
  });

  console.log('🔍 FINDING OPTIMAL FROM ANCHOR', {
    anchorTable,
    anchorIndex,
    groupName: group.group_name,
    partySize,
    sortedTables: sortedTables.map(t => `T${t.table_number}(${t.seats})`),
    groupTableNumbers: group.table_numbers
  });

  let bestCombination: typeof sortedTables | null = null;
  let bestWaste = Infinity;

  // Try building contiguous ranges that include the anchor
  // Strategy 1: Start from anchor, expand forward
  for (let endIdx = anchorIndex; endIdx < sortedTables.length; endIdx++) {
    const candidateTables = sortedTables.slice(anchorIndex, endIdx + 1);
    const tableNumbers = candidateTables.map(t => t.table_number).sort((a, b) => a - b);
    
    // ✅ CRITICAL: Validate physical consecutiveness
    const isPhysicallyConsecutive = tableNumbers.every((num, i) => 
      i === 0 || num === tableNumbers[i - 1] + 1
    );
    
    if (!isPhysicallyConsecutive) {
      console.log('⚠️ SKIPPING NON-CONSECUTIVE (forward)', { 
        candidateTables: tableNumbers,
        reason: 'Tables are not numerically consecutive'
      });
      continue; // Try next combination
    }
    
    const totalSeats = candidateTables.reduce((sum, t) => sum + t.seats, 0);
    
    if (totalSeats >= partySize) {
      const waste = totalSeats - partySize;
      if (waste < bestWaste) {
        bestWaste = waste;
        bestCombination = candidateTables;
      }
      break; // Found sufficient capacity going forward
    }
  }

  // Strategy 2: Start before anchor, expand to include anchor
  for (let startIdx = 0; startIdx <= anchorIndex; startIdx++) {
    for (let endIdx = anchorIndex; endIdx < sortedTables.length; endIdx++) {
      const candidateTables = sortedTables.slice(startIdx, endIdx + 1);
      const tableNumbers = candidateTables.map(t => t.table_number).sort((a, b) => a - b);
      
      // ✅ CRITICAL: Validate physical consecutiveness (e.g., reject [5,6,7,3])
      const isPhysicallyConsecutive = tableNumbers.every((num, i) => 
        i === 0 || num === tableNumbers[i - 1] + 1
      );
      
      if (!isPhysicallyConsecutive) {
        console.log('⚠️ SKIPPING NON-CONSECUTIVE', { 
          candidateTables: tableNumbers,
          reason: 'Tables are not numerically consecutive'
        });
        continue; // Skip this non-consecutive combination
      }
      
      const totalSeats = candidateTables.reduce((sum, t) => sum + t.seats, 0);
      
      if (totalSeats >= partySize) {
        const waste = totalSeats - partySize;
        if (waste < bestWaste) {
          bestWaste = waste;
          bestCombination = candidateTables;
        }
        break; // Move to next start position
      }
    }
  }

  if (!bestCombination) {
    console.log('❌ NO COMBINATION FOUND FROM ANCHOR', {
      anchorTable,
      partySize,
      availableTablesInGroup: sortedTables.length,
      totalGroupCapacity: sortedTables.reduce((sum, t) => sum + t.seats, 0)
    });
    return null;
  }

  const totalCapacity = bestCombination.reduce((sum, t) => sum + t.seats, 0);
  const tableNumbers = bestCombination.map(t => t.table_number);

  console.log('✅ OPTIMAL PARTIAL FOUND', {
    anchorTable,
    selectedTables: tableNumbers,
    tableCount: tableNumbers.length,
    totalGroupTables: group.table_numbers.length,
    capacity: totalCapacity,
    partySize,
    waste: totalCapacity - partySize,
    isPartial: tableNumbers.length < group.table_numbers.length
  });

  return {
    tables: tableNumbers,
    groupName: group.group_name,
    reason: `Partial "${group.group_name}" from anchor ${anchorTable}: ${tableNumbers.join(', ')} (${totalCapacity} seats for ${partySize} guests)`,
    isPartial: tableNumbers.length < group.table_numbers.length,
    actualCapacity: totalCapacity
  };
}

/**
 * Validate a table assignment and suggest improvements
 */
export function validateAndSuggestTableAssignment(
  proposedTables: number[],
  partySize: number,
  tableGroups: TableGroupWithTables[],
  availableTables: { table_number: number; seats: number }[] = []
): {
  isValid: boolean;
  suggestion?: {
    tables: number[];
    reason: string;
    improves: string;
  };
  warning?: string;
} {
  const validation = isValidTableCombination(proposedTables, tableGroups);
  
  if (!validation.valid) {
    // Invalid combination - suggest a valid alternative using smart assignment
    if (proposedTables.length > 1) {
      const firstTable = proposedTables[0];
      const optimalAssignment = findOptimalPartialGroupAssignment(firstTable, partySize, tableGroups, availableTables);
      
      return {
        isValid: false,
        suggestion: {
          tables: optimalAssignment.tables,
          reason: optimalAssignment.reason,
          improves: 'Ensures tables can be combined according to configured table groups'
        }
      };
    }
  }

  // Valid combination - check if we can suggest a better/more efficient assignment
  if (validation.valid && proposedTables.length === 1 && partySize > 8) {
    const optimalAssignment = findOptimalPartialGroupAssignment(proposedTables[0], partySize, tableGroups, availableTables);
    
    if (optimalAssignment.isPartial && optimalAssignment.tables.length > 1) {
      return {
        isValid: true,
        suggestion: {
          tables: optimalAssignment.tables,
          reason: optimalAssignment.reason,
          improves: `More efficient: uses ${optimalAssignment.tables.length} tables instead of full group for ${partySize} guests`
        }
      };
    }
  }

  // Check if we can optimize multi-table assignments by reducing tables
  if (validation.valid && proposedTables.length > 1) {
    const optimalAssignment = findOptimalPartialGroupAssignment(proposedTables[0], partySize, tableGroups, availableTables);
    
    if (optimalAssignment.tables.length < proposedTables.length && optimalAssignment.actualCapacity >= partySize) {
      return {
        isValid: true,
        suggestion: {
          tables: optimalAssignment.tables,
          reason: `More efficient: ${optimalAssignment.tables.length} tables instead of ${proposedTables.length} for ${partySize} guests`,
          improves: `Reduces table usage and frees up ${proposedTables.length - optimalAssignment.tables.length} table(s) for other customers`
        }
      };
    }
  }

  return { isValid: validation.valid };
}

/**
 * Find the optimal combination of tables within a group for a given party size
 * Uses combination evaluation to find minimum tables with minimum waste
 */
function findOptimalTableCombination(
  tablesWithSeats: { table_number: number; seats: number }[],
  partySize: number,
  targetTable: number,
  group: { group_name: string; table_numbers: number[]; max_combined_capacity: number },
  mustIncludeTarget: boolean = true
): {
  tables: number[];
  groupName: string;
  reason: string;
  isPartial: boolean;
  actualCapacity: number;
} | null {
  // Enforce adjacency strictly by contiguous slices in group.table_numbers order
  const order = group.table_numbers || [];
  if (!order.length) return null;

  const seatMap = new Map<number, number>(tablesWithSeats.map(t => [t.table_number, t.seats]));
  const candidates: { tables: number[]; capacity: number; waste: number }[] = [];

  // Evaluate all contiguous windows
  for (let size = 1; size <= order.length; size++) {
    for (let start = 0; start + size <= order.length; start++) {
      const slice = order.slice(start, start + size);
      const capacity = slice.reduce((sum, tn) => sum + (seatMap.get(tn) ?? 0), 0);
      if (capacity >= partySize) {
        candidates.push({ tables: slice, capacity, waste: capacity - partySize });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Filter to candidates that include the target table if mustIncludeTarget is true
  let filteredCandidates = candidates;
  if (mustIncludeTarget) {
    const withTarget = candidates.filter(c => c.tables.includes(targetTable));
    if (withTarget.length > 0) {
      filteredCandidates = withTarget;
    }
    // If no candidates include target and mustIncludeTarget is true, fallback to all candidates
  }

  // Sort by: 1) Fewest tables, 2) Least waste, 3) Prefer including target table
  filteredCandidates.sort((a, b) => {
    if (a.tables.length !== b.tables.length) return a.tables.length - b.tables.length;
    if (a.waste !== b.waste) return a.waste - b.waste;
    const aHas = a.tables.includes(targetTable) ? 1 : 0;
    const bHas = b.tables.includes(targetTable) ? 1 : 0;
    return bHas - aHas;
  });

  const optimal = filteredCandidates[0];

  return {
    tables: optimal.tables, // already in group order (contiguous)
    groupName: group.group_name,
    reason: `Optimal contiguous: ${optimal.tables.length}/${order.length} tables from "${group.group_name}" (${optimal.capacity} seats for ${partySize}, ${optimal.waste} waste)`,
    isPartial: optimal.tables.length < order.length,
    actualCapacity: optimal.capacity
  };
}

/**
 * Generate all combinations of a given size from an array
 */
function generateCombinations<T>(
  array: T[],
  size: number
): T[][] {
  if (size === 1) {
    return array.map(item => [item]);
  }
  
  const combinations: T[][] = [];
  
  for (let i = 0; i <= array.length - size; i++) {
    const head = array[i];
    const tailCombinations = generateCombinations(array.slice(i + 1), size - 1);
    
    for (const tailCombination of tailCombinations) {
      combinations.push([head, ...tailCombination]);
    }
  }
  
  return combinations;
}

/**
 * Check if the provided tables form a contiguous slice within the group's table_numbers order
 */
export function areTablesContiguousInGroup(
  tables: number[],
  group: TableGroupWithTables
): boolean {
  if (!group.table_numbers || tables.length <= 1) return true;
  
  const order = group.table_numbers;
  const indices = tables.map(t => order.indexOf(t));
  
  // Check if all tables are in the group
  if (indices.some(i => i === -1)) {
    return false;
  }
  
  // Sort indices to check for consecutiveness (works for both forward and backward)
  const sortedIndices = [...indices].sort((a, b) => a - b);
  
  // Check if sorted indices form a consecutive sequence
  for (let i = 1; i < sortedIndices.length; i++) {
    if (sortedIndices[i] !== sortedIndices[i - 1] + 1) {
      return false;
    }
  }
  
  return true;
}