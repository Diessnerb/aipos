import { CapacityLogicService } from './capacityLogicService';
import { Table } from '@/types/table';

/**
 * Test function to demonstrate partial assignment logic
 * This shows how a party of 35 should get 5 tables (35 seats) instead of 7 tables (49 seats)
 */
export function testPartialAssignment() {
  console.log('🧪 Testing Partial Assignment Logic for 35-person party');
  
  // Mock table group with 7 tables (as mentioned in the issue)
  const mockTables: Table[] = [
    { id: '1', table_number: 1, seats: 5, table_name: 'T1', company_id: 'test', status: 'active', created_at: '2025-01-01' },
    { id: '2', table_number: 2, seats: 5, table_name: 'T2', company_id: 'test', status: 'active', created_at: '2025-01-01' },
    { id: '3', table_number: 3, seats: 7, table_name: 'T3', company_id: 'test', status: 'active', created_at: '2025-01-01' },
    { id: '4', table_number: 4, seats: 7, table_name: 'T4', company_id: 'test', status: 'active', created_at: '2025-01-01' },
    { id: '5', table_number: 5, seats: 7, table_name: 'T5', company_id: 'test', status: 'active', created_at: '2025-01-01' },
    { id: '6', table_number: 6, seats: 9, table_name: 'T6', company_id: 'test', status: 'active', created_at: '2025-01-01' },
    { id: '7', table_number: 7, seats: 9, table_name: 'T7', company_id: 'test', status: 'active', created_at: '2025-01-01' }
  ];
  
  const partySize = 35;
  const totalGroupSeats = mockTables.reduce((sum, t) => sum + t.seats, 0); // 49 seats
  
  console.log(`Party Size: ${partySize}`);
  console.log(`Full Group: 7 tables with ${totalGroupSeats} seats (${Math.round((partySize/totalGroupSeats)*100)}% efficiency)`);
  
  // Test minimal assignment
  const minimalAssignment = CapacityLogicService.calculateMinimalTableAssignment(partySize, mockTables);
  console.log(`Minimal Assignment: ${minimalAssignment.tables.length} tables with ${minimalAssignment.actualCapacity} seats (${minimalAssignment.efficiency}% efficiency)`);
  console.log(`Selected Tables: ${minimalAssignment.tables.map(t => `T${t.table_number}(${t.seats})`).join(', ')}`);
  
  // Test partial vs full decision
  const partialAnalysis = CapacityLogicService.shouldUsePartialAssignment(
    partySize,
    { max_combined_capacity: totalGroupSeats },
    mockTables
  );
  
  console.log(`Should Use Partial: ${partialAnalysis.usePartial}`);
  console.log(`Reason: ${partialAnalysis.reason}`);
  
  if (partialAnalysis.usePartial && partialAnalysis.partialAssignment) {
    const partial = partialAnalysis.partialAssignment;
    console.log(`✅ RESULT: Use ${partial.tables.length} tables instead of 7 (saves ${7 - partial.tables.length} tables)`);
    console.log(`Seat utilization improves from ${Math.round((partySize/totalGroupSeats)*100)}% to ${partial.efficiency}%`);
  } else {
    console.log(`❌ Would still use full group assignment`);
  }
}