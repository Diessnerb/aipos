# Device Binding Comprehensive Test Plan

## Phase 4: Multi-Device Synchronization Testing

### 4.1 Online Multi-Device Sync Test
**Test Scenario:**
1. Login on Device A (tablet with PIN)
2. Login on Device B (tablet with PIN)
3. Create reservation on Device A
4. **Expected:** Reservation appears on Device B within 2 seconds
5. Update reservation on Device B
6. **Expected:** Update appears on Device A within 2 seconds
7. Delete reservation on Device A
8. **Expected:** Deletion syncs to Device B within 2 seconds

**Verification Points:**
- [ ] Both devices show DeviceDataManager running
- [ ] Real-time subscription active on both devices
- [ ] No duplicate subscriptions in console
- [ ] Data changes trigger cache updates
- [ ] UI re-renders automatically
- [ ] No "PIN required" errors

**Expected Behavior:**
- `DeviceDataManager` on both devices subscribes to `reservations` table
- Postgres changes trigger Supabase Realtime
- Both devices receive events and update React Query cache
- Components read from cache and re-render

---

### 4.2 Offline Mode Test
**Test Scenario:**
1. Login on Device A (online)
2. Take Device A offline (airplane mode or disable WiFi)
3. Create/update 3 reservations while offline
4. **Expected:** Data is queued in `OfflineMutationQueue`
5. **Expected:** Local cache updates immediately
6. Open reservation list - should show offline changes
7. Bring Device A back online
8. **Expected:** Mutations sync automatically within 5 seconds
9. Check Device B - should see all changes

**Verification Points:**
- [ ] Offline mutations are queued (check console logs)
- [ ] Local IndexedDB cache is updated
- [ ] UI shows offline changes immediately
- [ ] "Offline" indicator appears
- [ ] On reconnection, queue processes automatically
- [ ] Device B receives all synced changes
- [ ] No data loss or corruption

**Expected Behavior:**
- `offlineAwareInsert/Update` queues mutations
- `OfflineStorageService` caches data locally (IndexedDB)
- Components use cached data (via `useInstantData`)
- On reconnection, `OfflineMutationQueue.syncQueue()` runs
- Mutations are sent via `pin-mutation` edge function
- Both devices update via Realtime subscription

---

### 4.3 Offline-to-Online Conflict Resolution Test
**Test Scenario:**
1. Device A and Device B both online
2. Take both offline
3. Both devices update the SAME reservation (different fields)
4. Bring Device A online first → syncs
5. Bring Device B online → syncs (potential conflict)

**Verification Points:**
- [ ] Last-write-wins based on mutation timestamp
- [ ] No crashes or errors
- [ ] Final state is consistent across devices
- [ ] Conflict logged in console for debugging

**Expected Behavior:**
- Last-write-wins (based on mutation timestamp)
- Or optimistic UI with conflict notification
- Need to verify conflict resolution strategy in `pin-mutation` edge function

---

### 4.4 Mixed Mode (One Online, One Offline) Test
**Test Scenario:**
1. Device A online, Device B offline
2. Create reservation on Device A
3. Device B doesn't see it yet (expected)
4. Bring Device B online
5. **Expected:** Device B receives update within 2 seconds
6. No conflicts or data loss

**Verification Points:**
- [ ] Device A changes persist to database
- [ ] Device B's cache updates on reconnection
- [ ] No duplicate entries
- [ ] Timestamps are accurate

---

## Phase 6: Edge Function Consistency Verification

### All `pin-*-fetch` Edge Functions Must:

1. ✅ Accept `isDeviceBound` parameter in request body
2. ✅ Skip PIN validation when `isDeviceBound === true`
3. ✅ Use service role client to bypass RLS
4. ✅ Return consistent response format: `{ success: boolean, data: any[], error?: string }`
5. ✅ Log meaningful console messages for debugging
6. ✅ Handle CORS properly

### Edge Functions Verified:
- ✅ `pin-reservations-fetch` - Correct
- ✅ `pin-customers-fetch` - Correct
- ✅ `pin-tables-fetch` - Correct
- ✅ `pin-users-fetch` - Correct
- ✅ `pin-orders-fetch` - Correct
- ✅ `pin-deals-fetch` - Correct
- ✅ `pin-ingredients-fetch` - Correct
- ✅ `pin-suppliers-fetch` - Correct
- ✅ `pin-wastage-fetch` - Correct
- ✅ `pin-menu-items-fetch` - Correct
- ✅ `pin-menu-categories-fetch` - Correct
- ✅ `pin-analytics-reservations-fetch` - Correct
- ✅ `pin-analytics-revenue-fetch` - Correct

### Standard Edge Function Template:
```typescript
const { pin, companyId, isDeviceBound } = await req.json();

if (!companyId) {
  return new Response(
    JSON.stringify({ success: false, error: 'Company ID required' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

let validatedUser = null;

// If device is bound, skip PIN validation (trusted device)
if (!isDeviceBound) {
  if (!pin) {
    return new Response(
      JSON.stringify({ success: false, error: 'PIN required for non-bound devices' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // Validate PIN using standardized RPC function
  const { data: pinValidation, error: pinError } = await supabaseServiceRole
    .rpc('authenticate_by_pin_for_company_secure', {
      pin_input: pin,
      company_id_input: companyId
    });

  if (pinError || !pinValidation || pinValidation.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid PIN or company access' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  validatedUser = pinValidation[0];
} else {
  console.log('✅ Bound device access - skipping PIN validation');
}

// Fetch data using service role client...
const { data, error } = await supabaseServiceRole
  .from('table_name')
  .select('*')
  .eq('company_id', companyId);

return new Response(
  JSON.stringify({ 
    success: true, 
    data: data || [],
    user: validatedUser?.user_name,
    userRole: validatedUser?.user_role
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

---

## Phase 7: Critical Testing Checklist

### Online Mode (Bound Device)
- [ ] Login with PIN
- [ ] View reservations (should load instantly from cache)
- [ ] Create reservation (should sync to other devices within 2s)
- [ ] Update reservation (should sync to other devices within 2s)
- [ ] Delete reservation (should sync to other devices within 2s)
- [ ] View customers (should show correct visit counts)
- [ ] Customer visit count updates in real-time
- [ ] Menu items load instantly
- [ ] Orders sync across devices
- [ ] No duplicate subscriptions in console (check for duplicate channel names)
- [ ] No "PIN required" errors
- [ ] DeviceDataManager logs show "✅" for all critical caches
- [ ] Real-time events logged with "🔄" prefix

### Offline Mode (Bound Device)
- [ ] Take device offline (airplane mode)
- [ ] View reservations (should show cached data)
- [ ] Create reservation (should queue mutation)
- [ ] Update reservation (should queue mutation)
- [ ] Delete reservation (should queue mutation)
- [ ] View customers (should show cached data)
- [ ] Visit counts still calculate correctly
- [ ] Menu items accessible
- [ ] Orders viewable from cache
- [ ] No errors or crashes
- [ ] "Offline" indicator visible
- [ ] Queue status visible in console
- [ ] Bring device online → mutations sync automatically within 5s
- [ ] Other devices receive synced changes within 2s of sync completion
- [ ] Queue empties successfully

### Mixed Mode (One Online, One Offline)
- [ ] Device A online, Device B offline
- [ ] Create reservation on Device A
- [ ] Device B doesn't see it yet (expected)
- [ ] Bring Device B online
- [ ] Device B receives update within 2 seconds
- [ ] No conflicts or data loss
- [ ] Take Device A offline
- [ ] Create reservation on Device A (queued)
- [ ] Update same reservation on Device B (online)
- [ ] Bring Device A online
- [ ] Conflict resolution works correctly
- [ ] Final state is consistent

### Edge Cases
- [ ] Network interruption during sync (test with throttling)
- [ ] Rapid create/update/delete operations (stress test)
- [ ] Multiple devices editing same reservation simultaneously
- [ ] Device binding persists across page refresh
- [ ] PIN cache works after offline period
- [ ] Reconnection after long offline period (test with 1+ hour offline)
- [ ] Cache expiration and refresh (24+ hour test)
- [ ] Low storage scenario (IndexedDB quota)
- [ ] Device unbinding clears all caches
- [ ] Re-binding after unbinding works correctly
- [ ] Browser close/reopen preserves device binding
- [ ] Multiple browser tabs on same device (data consistency)

### Performance Benchmarks
- [ ] Initial load < 500ms (with warm cache)
- [ ] Reservation list render < 100ms
- [ ] Real-time update latency < 2s
- [ ] Offline mutation queue processing < 5s per item
- [ ] Cache hit rate > 95% for bound devices
- [ ] Memory usage stable over 8+ hours

### Security Validation
- [ ] PIN required for non-bound devices
- [ ] Bound devices skip PIN validation
- [ ] Service role key never exposed to client
- [ ] RLS bypassed only via service role
- [ ] Local storage encrypted (device binding data)
- [ ] No sensitive data in console logs (PINs redacted)
- [ ] Edge functions validate companyId
- [ ] Cross-company data access blocked

---

## Test Data Setup

### Required Test Data:
1. **Company**: Test restaurant with ID
2. **Users**: 
   - Owner user with PIN (e.g., "1234")
   - Staff user with PIN (e.g., "5678")
3. **Tables**: At least 10 tables with varying capacities
4. **Reservations**: 20+ reservations across multiple dates
5. **Customers**: 50+ customers with visit history
6. **Menu Items**: 30+ items across multiple categories
7. **Orders**: 10+ active orders
8. **Wastage**: 20+ wastage log entries

### Test Environment:
- 2+ physical tablets or tablet simulators
- Chrome DevTools for network throttling
- Browser console for debugging
- IndexedDB inspector
- Network request logger

---

## Success Criteria

### Must Pass:
✅ All online mode tests pass
✅ All offline mode tests pass
✅ All mixed mode tests pass
✅ Zero "PIN required" errors on bound devices
✅ Zero duplicate subscriptions
✅ Real-time sync < 2s
✅ Offline queue processing successful
✅ No data loss in any scenario
✅ Performance benchmarks met

### Critical Metrics:
- Data consistency: 100%
- Uptime: 99.9%
- Sync latency: < 2s
- Cache hit rate: > 95%
- Error rate: < 0.1%

---

## Troubleshooting Guide

### Issue: "PIN required for non-bound devices" error
**Root Cause:** Edge function call missing `isDeviceBound: true`
**Fix:** Add `isDeviceBound` parameter to edge function invocation
**Verification:** Check all `supabase.functions.invoke()` calls

### Issue: Duplicate real-time subscriptions
**Root Cause:** Both DeviceDataManager and RealtimeProvider subscribing
**Fix:** RealtimeProvider should check `useDeviceLiveLayer().isActive` and skip if true
**Verification:** Search console for duplicate channel names

### Issue: Offline mutations not syncing
**Root Cause:** Queue not processing on reconnection
**Fix:** Ensure `OfflineMutationQueue.syncQueue()` is called in reconnection handler
**Verification:** Check for "🔄 Processing offline mutation queue" logs

### Issue: Stale cache data
**Root Cause:** Cache not invalidating after updates
**Fix:** Ensure real-time subscription updates React Query cache
**Verification:** Check `queryClient.setQueryData()` calls in subscription handlers

### Issue: Device unbinding doesn't clear cache
**Root Cause:** `clearBoundCompany()` not clearing all caches
**Fix:** Call `OfflineStorageService.clearAll()` and `queryClient.clear()`
**Verification:** Check IndexedDB and localStorage are empty after unbinding
