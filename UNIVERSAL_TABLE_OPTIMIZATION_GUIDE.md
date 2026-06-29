# Universal Table Optimization System

## Overview
This system implements a comprehensive, universal table optimization strategy that is applied consistently across **ALL** table assignment operations in the application.

## Core Optimization Rules

### Priority 1: Minimize Number of Tables
The system always prioritizes using fewer tables over more tables, even if it means more total seats.

**Example**: 
- **Preferred**: 2 tables of 6 seats (12 seats total, 2 wasted for 10 guests)
- **Not Preferred**: 3 tables of 4 seats (12 seats total, 2 wasted for 10 guests)

### Priority 2: Minimize Wasted Seats
When the number of tables is equal, the system chooses the configuration with fewer wasted seats.

**Example** for 22 guests:
- **Preferred**: t11,12,14 (24 seats, 2 wasted)
- **Not Preferred**: t1,2,5,6 (28 seats, 6 wasted)

## Assignment Strategy (Step-by-Step)

### Step A: Single Individual Tables
1. **First Check**: Non-group tables that can accommodate the party
2. **Selection**: Smallest table with minimal waste
3. **Special Case**: If a group table is significantly better (50%+ waste reduction AND saves 2+ seats), it may be used instead

### Step B: Partial Table Groups
1. **Consecutive Rule**: Only physically adjacent tables within a group
2. **Availability Check**: All tables in the sub-group must be available
3. **Forbidden**: Non-consecutive combinations (e.g., T1 + T3 without T2)
4. **Selection**: Fewest tables first, then least waste

### Step C: Full Table Groups
1. **Check**: Entire group availability
2. **Selection**: Smallest group that accommodates the party size

## Locking System

### Permanent Lock (`is_locked`)
- Set manually by users
- Prevents **all** automated optimizations
- Reservation can still be moved manually by users
- Icon: 🔒 (locked) / 🔓 (unlocked)

### Temporary Lock (`last_manual_move_time`)
- Automatically set when a user manually moves a reservation
- **Duration**: 10 seconds
- **Blocks**: Only automated optimization processes
- **Allows**: Manual user moves at any time
- **Purpose**: Prevents the system from immediately un-doing a user's intentional move

### Lock Behavior Matrix

| Scenario | Permanent Lock | Temporary Lock | Automated Optimization | Manual User Move |
|----------|---------------|----------------|----------------------|------------------|
| Normal reservation | ❌ No | ❌ No | ✅ Allowed | ✅ Allowed |
| User just moved (< 10s) | ❌ No | ✅ Yes | ❌ Blocked | ✅ Allowed |
| Permanently locked | ✅ Yes | N/A | ❌ Blocked | ✅ Allowed |

## Universal Application Points

The universal optimization is automatically applied in:

1. **New Reservation Modal** - When creating reservations
2. **Edit Reservation Modal** - When editing existing reservations  
3. **Quick-Add Functions** - Timeline quick-add features
4. **Auto Smart Assign** - All automated assignment logic
5. **Drag & Drop** - When moving reservations on the timeline

## Database Schema

### New Fields Added to `reservations` Table

```sql
-- Permanent user lock
is_locked BOOLEAN DEFAULT false

-- Timestamp for 10-second automation lock
last_manual_move_time TIMESTAMP WITH TIME ZONE DEFAULT NULL
```

## API Usage

### For Developers

```typescript
import { TableAssignmentOrchestrator } from '@/services/tableAssignmentOrchestrator';

// New reservation
const result = await TableAssignmentOrchestrator.assignForNewReservation(
  companyId,
  partySize,
  date,
  time
);

// Edit existing reservation
const result = await TableAssignmentOrchestrator.assignForReservationEdit(
  companyId,
  partySize,
  date,
  time,
  existingReservation
);

// Automated optimization (respects locks)
const result = await TableAssignmentOrchestrator.autoAssignTables(
  companyId,
  partySize,
  date,
  time,
  existingReservation
);

// Mark manual move (starts 10-second timer)
await TableAssignmentOrchestrator.markManualMove(reservationId);

// Toggle permanent lock
await TableAssignmentOrchestrator.toggleLock(reservationId, true);
```

## Result Structure

```typescript
interface OptimizationResult {
  success: boolean;
  tables: number[];
  reason: string;
  strategy: 'single_individual' | 'single_group_table' | 'partial_group' | 'full_group' | 'failed';
  wastedSeats: number;
  totalSeats: number;
  groupName?: string;
  error?: string;
  locked?: boolean;
}
```

## Examples

### Example 1: 4 Guests
**Available**: Table 5 (4 seats), Table 8 (6 seats), Group Alpha with T1,T2 (4+4 seats)

**Result**: Table 5 (single individual table, perfect fit, 0 waste)

### Example 2: 10 Guests
**Available**: Table 10 (10 seats), Table 15 (14 seats, in Group Beta)

**Result**: Table 15 from Group Beta (50% waste reduction justifies using group table)

### Example 3: 22 Guests
**Available**: 
- Group A: T1,2,5,6 (6+6+8+8=28 seats)
- Group B: T11,12,14 (8+8+8=24 seats)

**Result**: Group B: T11,12,14 (Priority 1: 3 tables < 4 tables; Priority 2: 2 wasted < 6 wasted)

### Example 4: Locked Reservation
**Scenario**: Automated optimization tries to move a recently manually-moved reservation

**Result**: ❌ Blocked - "Reservation has a temporary lock (7s remaining)"

## Benefits

1. **Consistency**: Same logic everywhere - no surprises
2. **Efficiency**: Optimal table utilization across the board
3. **User Control**: Lock system respects user intentions
4. **Smart Fallbacks**: Sophisticated group table selection when needed
5. **Transparency**: Clear reasons for every assignment decision

## Monitoring & Logging

All assignments are logged to the `assignment_history` table with:
- Strategy used
- Tables assigned
- Success/failure status
- Optimization details

## Future Enhancements

Potential additions (not yet implemented):
- Machine learning for demand prediction
- Dynamic lock timeout based on time of day
- VIP preference handling
- Accessibility-first routing
