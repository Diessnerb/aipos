import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBoundCompany, isDeviceBound } from '@/utils/deviceBinding';
import { getRawPin } from '@/utils/pinAuth';
import { OfflineStorage } from './OfflineStorageService';
import { OfflineMutationQueue } from './OfflineMutationQueue';
import { ReconnectionManager } from './ReconnectionManager';
import { toast } from '@/hooks/use-toast';

interface RealtimeSubscription {
  channel: any;
  table: string;
  cleanup: () => void;
}

class DeviceDataManagerClass {
  private queryClient: QueryClient | null = null;
  private companyId: string | null = null;
  private subscriptions: RealtimeSubscription[] = [];
  private isActive = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Track per-reservation commit timestamps for freshness checks
  private reservationCommitTimestamps = new Map<string, number>();
  private lastSeenUpdatedAt = new Map<string, string>();

  // Offline storage and sync tracking
  private offlineMode: boolean = false;
  private lastOnlineSync: number | null = null;
  private persistenceQueue: Map<string, any> = new Map();
  private persistenceDebounceTimer: NodeJS.Timeout | null = null;
  private orientationChangeHandler: (() => void) | null = null;
  
  // Session heartbeat to prevent auth expiry
  private sessionHeartbeat: NodeJS.Timeout | null = null;

  async initialize(queryClient: QueryClient) {
    this.queryClient = queryClient;
    await OfflineStorage.initialize();
    console.log('🚀 DeviceDataManager initialized with offline storage');
  }

  async start(companyId: string): Promise<void> {
    // FIX #2: Detect company switch and clear all data
    if (this.isActive && this.companyId && this.companyId !== companyId) {
      console.log(`🔄 Company switch detected: ${this.companyId} → ${companyId}`);
      this.stop();
      this.queryClient?.clear();
      await OfflineStorage.setActiveCompany(companyId);
    }

    if (this.isActive && this.companyId === companyId) {
      console.log('⚡ DeviceDataManager already active for company:', companyId);
      return;
    }

    console.log('⚡ Starting DeviceDataManager for company:', companyId);
    console.log('🔧 Device mode:', {
      isBound: isDeviceBound(),
      useEdgeFunctions: this.shouldUseEdgeFunctions(),
      companyId
    });
    this.companyId = companyId;
    this.isActive = true;
    this.reconnectAttempts = 0;

    // Set active company for offline storage
    await OfflineStorage.setActiveCompany(companyId);

    // CRITICAL: Restore from offline storage FIRST (even when online) for instant UI
    try {
      await this.restoreFromOfflineStorage();
      console.log('✅ Cached data restored for instant display');
    } catch (error) {
      console.warn('⚠️ No offline cache available (first login):', error);
    }

    // Check network and seed/update data
    const isOnline = navigator.onLine;
    if (isOnline) {
      await this.seedInitialCache();
      this.offlineMode = false;
      this.lastOnlineSync = Date.now();
      await OfflineStorage.setLastSync(companyId, this.lastOnlineSync);
      setTimeout(() => this.setupRealtimeSubscriptions(), 100);
      
      // Start session heartbeat to prevent expiry
      this.startSessionHeartbeat();
    } else {
      console.log('📡 Offline mode - using cached data');
      this.offlineMode = true;
    }
    
    // Setup global cache persistence listener
    this.setupCachePersistenceListener();
    
    // Add orientation change protection
    this.orientationChangeHandler = () => {
      console.log('📱 Orientation changed, preserving cache');
      // Just persist current cache, don't restart
      this.persistCacheDebounced();
    };
    
    window.addEventListener('device-orientation-changed', this.orientationChangeHandler);
    
    this.setupNetworkListeners();
  }

  private startSessionHeartbeat(): void {
    // Clear existing heartbeat if any
    if (this.sessionHeartbeat) {
      clearInterval(this.sessionHeartbeat);
    }
    
    // Refresh session every 4 minutes (before 5 min expiry)
    this.sessionHeartbeat = setInterval(async () => {
      console.log('💓 Session heartbeat: Refreshing auth session');
      const { error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.warn('⚠️ Session refresh failed:', error);
        // Trigger recovery if refresh fails
        await this.handleSessionRecovery();
      } else {
        console.log('✅ Session heartbeat: Refresh successful');
      }
    }, 4 * 60 * 1000);
  }

  private async handleSessionRecovery(): Promise<void> {
    console.log('🔄 Attempting session recovery...');
    
    const success = await ReconnectionManager.handleReconnection(true);
    
    if (success) {
      console.log('✅ Session recovered successfully');
      // Dispatch event for components to refetch
      window.dispatchEvent(new CustomEvent('session-recovered'));
    } else {
      console.error('❌ Session recovery failed');
    }
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  private async handleOnline(): Promise<void> {
    if (!this.offlineMode) return;
    console.log('🌐 Network restored');
    this.offlineMode = false;
    
    // Use ReconnectionManager for coordinated reconnection
    const success = await ReconnectionManager.handleReconnection();
    
    if (success) {
      // Restart session heartbeat
      this.startSessionHeartbeat();
      // Dispatch recovery event
      window.dispatchEvent(new CustomEvent('session-recovered'));
    } else {
      // If reconnection failed, revert to offline mode
      this.offlineMode = true;
      console.error('❌ Failed to reconnect, staying in offline mode');
    }
  }

  private async handleOffline(): Promise<void> {
    console.log('📡 Offline mode activated');
    this.offlineMode = true;
    
    // Stop session heartbeat in offline mode
    if (this.sessionHeartbeat) {
      clearInterval(this.sessionHeartbeat);
      this.sessionHeartbeat = null;
    }
    
    // Immediately restore from offline storage to prevent data loss
    try {
      await this.restoreFromOfflineStorage();
      if (this.companyId) {
        await this.ensureCriticalCaches(this.companyId);
      }
      console.log('✅ Offline transition complete - data preserved');
    } catch (error) {
      console.warn('⚠️ Could not restore offline data:', error);
    }
    
    // Simple toast notification
    toast({ 
      title: "Offline Mode",
      description: "Working offline. Changes will sync when online.",
    });
    
    this.subscriptions.forEach(sub => {
      sub.cleanup();
    });
    this.subscriptions = [];
  }

  private async restoreFromOfflineStorage(): Promise<void> {
    if (!this.queryClient || !this.companyId) return;
    
    console.log('📦 Restoring data from offline storage...');
    const startTime = performance.now();
    
    try {
      const cachedData = await OfflineStorage.loadAllForCompany(this.companyId);
      
      if (cachedData.size === 0) {
        console.warn('⚠️ No offline cache available');
        throw new Error('No offline data available');
      }
      
      let restoredCount = 0;
      for (const [queryKeyStr, data] of cachedData.entries()) {
        const queryKey = queryKeyStr.split('::');
        this.queryClient.setQueryData(queryKey, data);
        restoredCount++;
      }
      
      const duration = Math.round(performance.now() - startTime);
      console.log(`✅ Restored ${restoredCount} queries from offline cache in ${duration}ms`);
      
      this.lastOnlineSync = await OfflineStorage.getLastSync(this.companyId);
      if (this.lastOnlineSync) {
        const timeSince = Math.round((Date.now() - this.lastOnlineSync) / 1000 / 60);
        console.log(`📡 Last online sync was ${timeSince} minutes ago`);
      }
    } catch (error) {
      console.error('❌ Failed to restore from offline storage:', error);
      throw error;
    }
  }

  private setupRealtimeSubscriptions(): void {
    if (!this.companyId || !this.queryClient) return;

    console.log('🚀 Setting up device-level realtime subscriptions');

    // Core tables that need real-time updates
    const tables = [
      'reservations',
      'tables', 
      'company_settings',
      'users',
      'customers',
      'menu_items',
      'menu_categories',
      'product_links',
      'menu_item_ingredients',
      'ingredients',
      'deals',
      'locations',
      'integrations',
      'marketing_campaigns',
      'inventory',
      'inventory_logs',
      'messages',
      'channels',
      'page_permissions',
      'table_groups',
      'table_group_memberships',
      'orders',
      'order_items',
      'payments',
      // Delivery system tables
      'suppliers',
      'delivery_schedules',
      'delivery_orders',
      'delivery_order_items',
      'ingredient_usage_analytics',
      'wastage_log',
      'menu_item_costing',
      'delivery_settings'
    ];

    tables.forEach(table => {
      this.subscribeToTable(table);
    });
  }

  private subscribeToTable(tableName: string): void {
    if (!this.companyId || !this.queryClient) return;

    const channel = supabase
      .channel(`device-${tableName}-${this.companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `company_id=eq.${this.companyId}`
        },
        (payload) => {
          console.log(`🚀 Device realtime update [${tableName}]:`, payload.eventType, payload);
          this.handleRealtimeUpdate(tableName, payload);
        }
      )
      .subscribe((status) => {
        console.log(`🚀 Subscription status [${tableName}]:`, status);
        if (status === 'SUBSCRIBED') {
          this.reconnectAttempts = 0;
        } else if (status === 'CHANNEL_ERROR') {
          this.handleConnectionError();
        }
      });

    const subscription: RealtimeSubscription = {
      channel,
      table: tableName,
      cleanup: () => supabase.removeChannel(channel)
    };

    this.subscriptions.push(subscription);
  }

  private handleRealtimeUpdate(tableName: string, payload: any): void {
    if (!this.queryClient || !this.companyId) return;

    const { eventType, new: newRecord, old: oldRecord } = payload;

    // Handle different query key patterns based on table
    switch (tableName) {
      case 'reservations':
        this.updateReservationsCache(eventType, newRecord, oldRecord, payload);
        break;
      case 'tables':
        this.updateTablesCache(eventType, newRecord, oldRecord);
        break;
      case 'company_settings':
        this.updateCompanySettingsCache(eventType, newRecord, oldRecord);
        break;
      case 'product_links':
        this.updateProductLinksCache(eventType, newRecord, oldRecord);
        break;
      case 'menu_item_ingredients':
        this.updateMenuItemIngredientsCache(eventType, newRecord, oldRecord);
        break;
      case 'table_groups':
      case 'table_group_memberships':
        // Special handling: These tables need RPC aggregation, so invalidate and refetch
        this.updateTableGroupsCache(tableName, eventType);
        break;
      case 'menu_items':
        this.updateMenuItemsCache(eventType, newRecord, oldRecord);
        break;
      case 'orders':
        this.updateOrdersCache(eventType, newRecord, oldRecord);
        break;
      case 'order_items':
        this.updateOrderItemsCache(eventType, newRecord, oldRecord);
        break;
      case 'payments':
        this.updatePaymentsCache(eventType, newRecord, oldRecord);
        break;
      // Delivery system tables
      case 'suppliers':
      case 'delivery_schedules':
      case 'delivery_settings':
      case 'menu_item_costing':
      case 'ingredient_usage_analytics':
        this.updateGenericCache(tableName, eventType, newRecord, oldRecord);
        break;
      case 'delivery_orders':
        this.updateDeliveryOrdersCache(eventType, newRecord, oldRecord);
        break;
      case 'delivery_order_items':
        this.updateDeliveryOrderItemsCache(eventType, newRecord, oldRecord);
        break;
      case 'wastage_log':
        this.updateWastageLogCache(eventType, newRecord, oldRecord);
        break;
      default:
        // Generic cache update for other tables
        this.updateGenericCache(tableName, eventType, newRecord, oldRecord);
    }
  }

  private updateReservationsCache(eventType: string, newRecord: any, oldRecord: any, payload?: any): void {
    if (!this.queryClient || !this.companyId) return;

    // Smart optimistic update protection
    if (eventType === 'UPDATE' && newRecord) {
      const targetDate = newRecord.date;
      const reservationId = newRecord.id;
      
      if (targetDate) {
        const dateCacheKey = ['reservations-date', this.companyId, targetDate];
        const currentCache = this.queryClient.getQueryData<any>(dateCacheKey);
        
        // Check for per-reservation optimistic update within 400ms window
        if (currentCache?.optimisticUpdates) {
          const optimisticTimestamp = currentCache.optimisticUpdates.get(reservationId);
          
          if (optimisticTimestamp && Date.now() - optimisticTimestamp < 400) {
            // Smart event matching: compare real-time data with optimistic data
            const existingReservation = currentCache.reservations?.find((r: any) => r.id === reservationId);
            
            if (existingReservation) {
              const tablesMatch = existingReservation.table_number === newRecord.table_number &&
                JSON.stringify(existingReservation.table_numbers) === JSON.stringify(newRecord.table_numbers);
              const timeMatches = existingReservation.time === newRecord.time;
              
              if (!tablesMatch || !timeMatches) {
                console.log('⏭️ DeviceDataManager: Skipping real-time update - conflicts with optimistic', {
                  reservationId,
                  optimisticAge: Date.now() - optimisticTimestamp,
                  tablesMatch,
                  timeMatches
                });
                return;
              } else {
                console.log('✅ DeviceDataManager: Real-time matches optimistic - confirming', {
                  reservationId,
                  optimisticAge: Date.now() - optimisticTimestamp
                });
              }
            }
          }
        }
      }
    }

    console.log(`🔄 DeviceDataManager: Updating reservations cache [${eventType}]`, { newRecord: newRecord?.id, oldRecord: oldRecord?.id });

    // Apply consistent data transformation using the same function as useUltraFastReservationsQuery
    const transformRows = (rows: any[] = []): any[] => rows.map((reservation: any) => {
      // Client-side reconciliation: normalize table data
      let tableNumber = reservation.table_number || null;
      let tableNumbers = reservation.table_numbers || null;
      
      // Reconcile table_number vs table_numbers inconsistencies
      if (tableNumbers?.length === 1 && tableNumber && tableNumber !== tableNumbers[0]) {
        console.log('📊 DeviceDataManager: Reconciling table data inconsistency:', { 
          table_number: tableNumber, 
          table_numbers: tableNumbers,
          resolved: 'using table_numbers[0]',
          reservationId: reservation.id
        });
        tableNumber = tableNumbers[0];
      }

      return {
        id: reservation.id,
        customer_name: reservation.customer_name,
        phone: reservation.phone || '',
        email: reservation.email || '',
        party_size: reservation.party_size,
        date: reservation.date,
        time: reservation.time || '19:00',
        end_time: reservation.end_time || null,
        table_number: tableNumber,
        table_numbers: tableNumbers,
        notes: reservation.notes || '',
        status: reservation.status || 'pending',
        locked: Boolean(reservation.locked) || false,
        locked_until: reservation.locked_until || null,
        has_allergens: Boolean(reservation.has_allergens) || false,
        allergens: reservation.allergens || [],
        updated_at: reservation.updated_at || null,
      };
    });

    // PHASE 1: Always accept realtime updates - database is source of truth for cross-device sync
    // Track timestamps for debugging only, never reject updates
    const reservationId = newRecord?.id || oldRecord?.id;
    const REALTIME_DEBUG = typeof window !== 'undefined' && (window as any).__DEBUG_REALTIME_SYNC__;
    
    if (reservationId && eventType === 'UPDATE' && newRecord) {
      const incomingTimestamp = payload.commit_timestamp;
      const tableChanged = oldRecord?.table_number !== newRecord?.table_number ||
                          JSON.stringify(oldRecord?.table_numbers) !== JSON.stringify(newRecord?.table_numbers);
      
      // Track timestamps for logging only - NEVER reject
      if (incomingTimestamp) {
        this.reservationCommitTimestamps.set(reservationId, incomingTimestamp);
      }
      if (newRecord?.updated_at) {
        this.lastSeenUpdatedAt.set(reservationId, newRecord.updated_at);
      }
      
      if (REALTIME_DEBUG) {
        console.log('🔄 REALTIME UPDATE ACCEPTED', {
          reservationId,
          eventType,
          tableChanged,
          incomingTimestamp,
          updatedAt: newRecord?.updated_at,
          oldTable: oldRecord?.table_number,
          newTable: newRecord?.table_number,
          source: 'DeviceDataManager'
        });
      } else {
        console.log(`🔄 DeviceDataManager: Applying realtime update for ${reservationId}`, {
          tableChanged,
          timestamp: incomingTimestamp
        });
      }
    }

    // Update main reservations cache with transformation
    const mainCacheKey = ['reservations', this.companyId];
    const currentData = this.queryClient.getQueryData<any[]>(mainCacheKey) || [];

    if (eventType === 'INSERT' && newRecord) {
      const transformedRecord = transformRows([newRecord])[0];
      this.queryClient.setQueryData(mainCacheKey, [...currentData, transformedRecord]);
    } else if (eventType === 'UPDATE' && newRecord) {
      const transformedRecord = transformRows([newRecord])[0];
      const updatedData = currentData.map(item => 
        item.id === newRecord.id ? transformedRecord : item
      );
      this.queryClient.setQueryData(mainCacheKey, updatedData);
    } else if (eventType === 'DELETE' && oldRecord) {
      const filteredData = currentData.filter(item => item.id !== oldRecord.id);
      this.queryClient.setQueryData(mainCacheKey, filteredData);
    }

    // Update date-specific caches with consistent format and keys
    const targetDate = newRecord?.date || oldRecord?.date;
    if (targetDate) {
      const dateCacheKey = ['reservations-date', this.companyId, targetDate];
      const currentCacheData = this.queryClient.getQueryData<any>(dateCacheKey);
      
      console.log(`🔄 DeviceDataManager: Updating date cache for ${targetDate}`, { currentCacheData });
      
      // Handle structured cache data format - expect DateSpecificReservations format
      let reservations = [];
      if (currentCacheData && Array.isArray(currentCacheData.reservations)) {
        reservations = currentCacheData.reservations;
      } else if (Array.isArray(currentCacheData)) {
        reservations = currentCacheData;
      }

      let updatedReservations = [];
      if (eventType === 'INSERT' && newRecord) {
        const transformedRecord = transformRows([newRecord])[0];
        updatedReservations = [...reservations, transformedRecord];
        console.log(`✅ DeviceDataManager: Added reservation ${newRecord.id} to ${targetDate}`);
        
        // For INSERT, also invalidate main cache and force refetch
        this.queryClient.invalidateQueries({ 
          queryKey: mainCacheKey,
          refetchType: 'active'
        });
      } else if (eventType === 'UPDATE' && newRecord) {
        const transformedRecord = transformRows([newRecord])[0];
        updatedReservations = reservations.map(item => 
          item.id === newRecord.id ? transformedRecord : item
        );
        
        // Check if this was a table assignment change
        const existingReservation = reservations.find(item => item.id === newRecord.id);
        if (existingReservation && (
            existingReservation.table_number !== transformedRecord.table_number ||
            JSON.stringify(existingReservation.table_numbers) !== JSON.stringify(transformedRecord.table_numbers)
          )) {
          console.log(`🎯 DeviceDataManager: Applied table move for ${newRecord.id}:`, {
            from: { table_number: existingReservation.table_number, table_numbers: existingReservation.table_numbers },
            to: { table_number: transformedRecord.table_number, table_numbers: transformedRecord.table_numbers }
          });
        }
        
        console.log(`✅ DeviceDataManager: Updated reservation ${newRecord.id} in ${targetDate}`);
      } else if (eventType === 'DELETE' && oldRecord) {
        updatedReservations = reservations.filter(item => item.id !== oldRecord.id);
        console.log(`✅ DeviceDataManager: Removed reservation ${oldRecord.id} from ${targetDate}`);
      }

        // Update with structured format expected by useUltraFastReservationsQuery
        const updatedCache = {
          date: targetDate,
          reservations: updatedReservations,
          lastUpdated: Date.now(), // Use current timestamp to force React Query state change
          isToday: targetDate === new Date().toISOString().split('T')[0]
        };
      
      // First cache update with new timestamp
      this.queryClient.setQueryData(dateCacheKey, updatedCache);
      
      // Check if table assignment changed for aggressive cross-device sync
      const tableChanged = oldRecord && newRecord && (
        oldRecord.table_number !== newRecord.table_number ||
        JSON.stringify(oldRecord.table_numbers) !== JSON.stringify(newRecord.table_numbers)
      );
      
      // PHASE 2: Use consistent immediate notification for ALL events
      // Notify observers immediately without refetch - realtime payload has all data
      this.queryClient.invalidateQueries({ 
        queryKey: dateCacheKey,
        refetchType: 'none' // Immediate notification, no refetch delay
      });
      
      // Force second cache update with incremented timestamp to guarantee React re-render
      this.queryClient.setQueryData(dateCacheKey, {
        ...updatedCache,
        lastUpdated: Date.now() + 1 // New reference ensures React detects change
      });
      
      const REALTIME_DEBUG = typeof window !== 'undefined' && (window as any).__DEBUG_REALTIME_SYNC__;
      if (REALTIME_DEBUG) {
        console.log('✅ REALTIME CACHE UPDATED', {
          eventType,
          targetDate,
          reservationCount: updatedReservations.length,
          cacheKey: dateCacheKey,
          tableChanged: tableChanged && eventType === 'UPDATE',
          timestamp: Date.now()
        });
      } else {
        console.log(`✅ DeviceDataManager: Immediate UI update for ${eventType} on ${targetDate}${tableChanged && eventType === 'UPDATE' ? ' (table move)' : ''}`);
      }
      
      console.log(`🔄 DeviceDataManager: Cache updated for ${targetDate} - ${updatedReservations.length} reservations`);
    }
  }

  private updateTablesCache(eventType: string, newRecord: any, oldRecord: any): void {
    if (!this.queryClient || !this.companyId) return;

    const cacheKey = ['tables', this.companyId];
    const currentData = this.queryClient.getQueryData<any[]>(cacheKey) || [];

    if (eventType === 'INSERT' && newRecord) {
      // Insert in correct position and sort by table_number
      const updatedData = [...currentData, newRecord].sort((a, b) => a.table_number - b.table_number);
      this.queryClient.setQueryData(cacheKey, updatedData);
    } else if (eventType === 'UPDATE' && newRecord) {
      const updatedData = currentData.map(item => 
        item.id === newRecord.id ? newRecord : item
      );
      // Re-sort in case table_number changed
      this.queryClient.setQueryData(cacheKey, updatedData.sort((a, b) => a.table_number - b.table_number));
    } else if (eventType === 'DELETE' && oldRecord) {
      const filteredData = currentData.filter(item => item.id !== oldRecord.id);
      this.queryClient.setQueryData(cacheKey, filteredData);
    }
  }

  private updateCompanySettingsCache(eventType: string, newRecord: any, oldRecord: any): void {
    if (!this.queryClient || !this.companyId) return;

    const cacheKey = ['company_settings', this.companyId];
    
    if (eventType === 'UPDATE' && newRecord) {
      this.queryClient.setQueryData(cacheKey, newRecord);
    } else if (eventType === 'INSERT' && newRecord) {
      this.queryClient.setQueryData(cacheKey, newRecord);
    }
  }

  private updateProductLinksCache(eventType: string, newRecord: any, oldRecord: any): void {
    if (!this.queryClient || !this.companyId) return;

    const cacheKey = ['menu-item-product-links', this.companyId];
    const currentCache = this.queryClient.getQueryData<Record<string, any[]>>(cacheKey) || {};

    if (eventType === 'INSERT' && newRecord) {
      const menuItemId = newRecord.menu_item_id;
      const existing = currentCache[menuItemId] || [];
      this.queryClient.setQueryData(cacheKey, {
        ...currentCache,
        [menuItemId]: [...existing, newRecord]
      });
      console.log(`✅ Added product link to ${menuItemId}`);
    } else if (eventType === 'UPDATE' && newRecord) {
      const menuItemId = newRecord.menu_item_id;
      const existing = currentCache[menuItemId] || [];
      this.queryClient.setQueryData(cacheKey, {
        ...currentCache,
        [menuItemId]: existing.map(link => link.id === newRecord.id ? newRecord : link)
      });
      console.log(`✅ Updated product link in ${menuItemId}`);
    } else if (eventType === 'DELETE' && oldRecord) {
      const menuItemId = oldRecord.menu_item_id;
      const existing = currentCache[menuItemId] || [];
      this.queryClient.setQueryData(cacheKey, {
        ...currentCache,
        [menuItemId]: existing.filter(link => link.id !== oldRecord.id)
      });
      console.log(`✅ Removed product link from ${menuItemId}`);
    }
  }

  private updateMenuItemIngredientsCache(eventType: string, newRecord: any, oldRecord: any): void {
    if (!this.queryClient || !this.companyId) return;
    
    const menuItemId = newRecord?.menu_item_id || oldRecord?.menu_item_id;
    if (!menuItemId) return;
    
    console.log(`🔄 DeviceDataManager: Updating menu_item_ingredients cache [${eventType}] for menu item ${menuItemId}`);
    
    // Update the specific menu item's ingredients cache
    const cacheKey = ['menu-item-ingredients', menuItemId];
    const currentData = this.queryClient.getQueryData<any[]>(cacheKey) || [];
    
    if (eventType === 'INSERT' && newRecord) {
      this.queryClient.setQueryData(cacheKey, [...currentData, newRecord].sort((a, b) => a.display_order - b.display_order));
    } else if (eventType === 'UPDATE' && newRecord) {
      const updatedData = currentData.map(item => 
        item.id === newRecord.id ? newRecord : item
      ).sort((a, b) => a.display_order - b.display_order);
      this.queryClient.setQueryData(cacheKey, updatedData);
    } else if (eventType === 'DELETE' && oldRecord) {
      const filteredData = currentData.filter(item => item.id !== oldRecord.id);
      this.queryClient.setQueryData(cacheKey, filteredData);
    }
    
    // ✅ CRITICAL: Also recalculate menu item allergens
    this.recalculateMenuItemAllergens(menuItemId);
    
    // Invalidate menu-item-allergens query to trigger refetch
    this.queryClient.invalidateQueries({ 
      queryKey: ['menu-item-allergens', menuItemId],
      refetchType: 'active'
    });
    
    // Persist to offline storage
    this.scheduleOfflinePersistence(cacheKey, this.queryClient.getQueryData(cacheKey));
  }

  private async recalculateMenuItemAllergens(menuItemId: string): Promise<void> {
    if (!this.queryClient || !this.companyId) return;
    
    try {
      // Fetch current ingredients for this menu item
      const ingredients = this.queryClient.getQueryData<any[]>(['menu-item-ingredients', menuItemId]) || [];
      
      // Calculate allergens from included ingredients only
      const allergens = ingredients
        .filter(ing => ing.is_included)
        .flatMap(ing => ing.allergens || []);
      
      const uniqueAllergens = [...new Set(allergens)].sort();
      
      console.log(`🔄 DeviceDataManager: Recalculated allergens for ${menuItemId}:`, uniqueAllergens);
      
      // Update the menu item with new allergens in the cache
      const menuItemsKey = ['menu_items', this.companyId];
      const menuItems = this.queryClient.getQueryData<any[]>(menuItemsKey) || [];
      
      const updatedMenuItems = menuItems.map(item => 
        item.id === menuItemId ? { ...item, allergens: uniqueAllergens } : item
      );
      
      this.queryClient.setQueryData(menuItemsKey, updatedMenuItems);
      
      // Also update in database (fire and forget, don't block)
      supabase
        .from('menu_items')
        .update({ allergens: uniqueAllergens })
        .eq('id', menuItemId)
        .then(({ error }) => {
          if (error) console.error('Failed to update menu item allergens:', error);
        });
      
      // Persist updated menu items to offline storage
      this.scheduleOfflinePersistence(menuItemsKey, updatedMenuItems);
    } catch (error) {
      console.error('Failed to recalculate menu item allergens:', error);
    }
  }

  private scheduleOfflinePersistence(queryKey: any[], data: any): void {
    if (!this.companyId) return;
    this.persistenceQueue.set(queryKey.join('::'), { queryKey, data });
    this.persistCacheDebounced();
  }

  private updateTableGroupsCache(tableName: string, eventType: string): void {
    if (!this.queryClient || !this.companyId) return;

    console.log(`🔄 DeviceDataManager: ${tableName} changed [${eventType}] - invalidating table groups RPC cache`);

    // The useTableGroups hook uses RPC function get_table_groups_with_tables
    // which aggregates table_groups + table_group_memberships with table_numbers
    // We need to invalidate and refetch to get fresh aggregated data
    const tableGroupsCacheKey = ['table_groups', this.companyId];
    
    this.queryClient.invalidateQueries({ 
      queryKey: tableGroupsCacheKey,
      refetchType: 'active' // Refetch active queries to get fresh RPC data
    });

    console.log(`✅ DeviceDataManager: Table groups cache invalidated and refetching`);
  }

  private updateOrdersCache(eventType: string, newRecord: any, oldRecord: any): void {
    if (!this.queryClient || !this.companyId) return;

    console.log(`🍽️ DeviceDataManager: Updating orders cache [${eventType}]`, { 
      orderId: newRecord?.id || oldRecord?.id 
    });

    // Update kitchen-orders cache (used by Kitchen Display)
    const kitchenCacheKey = ['kitchen-orders', this.companyId];
    const currentKitchenData = this.queryClient.getQueryData<any[]>(kitchenCacheKey) || [];

    if (eventType === 'INSERT' && newRecord) {
      // Only add if it matches kitchen filter (sent/preparing status)
      if (['sent', 'preparing'].includes(newRecord.kitchen_status)) {
        this.queryClient.setQueryData(kitchenCacheKey, [...currentKitchenData, newRecord]);
      }
    } else if (eventType === 'UPDATE' && newRecord) {
      // Update or remove based on kitchen_status
      if (['sent', 'preparing'].includes(newRecord.kitchen_status)) {
        const updatedData = currentKitchenData.map(item => 
          item.id === newRecord.id ? { ...item, ...newRecord } : item
        );
        // If not found, add it (edge case)
        if (!updatedData.find(item => item.id === newRecord.id)) {
          updatedData.push(newRecord);
        }
        this.queryClient.setQueryData(kitchenCacheKey, updatedData);
      } else {
        // Remove from kitchen if status changed to something else
        const filteredData = currentKitchenData.filter(item => item.id !== newRecord.id);
        this.queryClient.setQueryData(kitchenCacheKey, filteredData);
      }
    } else if (eventType === 'DELETE' && oldRecord) {
      const filteredData = currentKitchenData.filter(item => item.id !== oldRecord.id);
      this.queryClient.setQueryData(kitchenCacheKey, filteredData);
    }

    // Also update pos-orders and open-tabs caches
    this.queryClient.invalidateQueries({ queryKey: ['pos-orders'], refetchType: 'active' });
    this.queryClient.invalidateQueries({ queryKey: ['open-tabs'], refetchType: 'active' });
    
    // Update kitchen-ready-orders for notification bar
    this.queryClient.invalidateQueries({ queryKey: ['kitchen-ready-orders'], refetchType: 'active' });
  }

  private updateOrderItemsCache(eventType: string, newRecord: any, oldRecord: any): void {
    if (!this.queryClient || !this.companyId) return;

    console.log(`🍽️ DeviceDataManager: Order items changed [${eventType}]`, { 
      itemId: newRecord?.id || oldRecord?.id,
      orderId: newRecord?.order_id || oldRecord?.order_id 
    });

    // When order items change, we need to refetch the full order with items
    // because the query uses nested selects
    const affectedOrderId = newRecord?.order_id || oldRecord?.order_id;
    
    if (affectedOrderId) {
      const kitchenCacheKey = ['kitchen-orders', this.companyId];
      const currentData = this.queryClient.getQueryData<any[]>(kitchenCacheKey);
      
      if (currentData) {
        // Mark this specific order as needing a refresh by fetching it
        supabase
          .from('orders')
          .select(`
            id,
            external_pos_order_id,
            table_number,
            customer_name,
            created_at,
            scheduled_for,
            assignment_type,
            current_course_started_at,
            reservation_id,
            kitchen_status,
            reservation:reservations (
              id,
              status,
              customer_name
            ),
            order_items (
              id,
              quantity,
              unit_price,
              subtotal,
              course_type,
              is_prepared,
              modifications,
              notes,
              menu_items (
                id,
                name,
                category_id
              )
            )
          `)
          .eq('id', affectedOrderId)
          .single()
          .then(({ data, error }) => {
            if (data && !error) {
              // Parse modifications if needed
              const parsedData = {
                ...data,
                order_items: data.order_items?.map(item => ({
                  ...item,
                  modifications: typeof item.modifications === 'string' 
                    ? JSON.parse(item.modifications) 
                    : item.modifications
                }))
              };
              
              // Update the order in cache
              const updatedData = currentData.map(order => 
                order.id === affectedOrderId ? parsedData : order
              );
              this.queryClient!.setQueryData(kitchenCacheKey, updatedData);
              console.log(`✅ DeviceDataManager: Refreshed order ${affectedOrderId} with updated items`);
            }
          });
      }
    }
  }

  private updatePaymentsCache(eventType: string, newRecord: any, oldRecord: any): void {
    if (!this.queryClient || !this.companyId) return;

    console.log(`💳 DeviceDataManager: Payment changed [${eventType}]`, { 
      paymentId: newRecord?.id || oldRecord?.id,
      orderId: newRecord?.order_id || oldRecord?.order_id,
      amount: newRecord?.amount
    });

    // When payments change, we need to update:
    // 1. Open tabs (payment affects unpaid status and split payment display)
    // 2. POS orders (to reflect payment status changes)
    // 3. The specific order that was paid
    
    const affectedOrderId = newRecord?.order_id || oldRecord?.order_id;
    
    if (affectedOrderId) {
      // Invalidate open tabs to refresh payment status and amounts
      this.queryClient.invalidateQueries({ 
        queryKey: ['open-tabs', this.companyId], 
        refetchType: 'active' 
      });
      
      // Invalidate POS orders to update the order list
      this.queryClient.invalidateQueries({ 
        queryKey: ['pos-orders'], 
        refetchType: 'active' 
      });
      
      console.log(`✅ DeviceDataManager: Invalidated caches for payment update on order ${affectedOrderId}`);
    }
  }

  private updateDeliveryOrdersCache(eventType: string, newRecord: any, oldRecord: any): void {
    if (!this.queryClient || !this.companyId) return;

    const cacheKey = ['delivery_orders', this.companyId];
    const currentData = this.queryClient.getQueryData<any[]>(cacheKey) || [];

    if (eventType === 'INSERT' && newRecord) {
      const updatedData = [...currentData, newRecord].sort((a, b) => 
        new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
      );
      this.queryClient.setQueryData(cacheKey, updatedData);
    } else if (eventType === 'UPDATE' && newRecord) {
      const updatedData = currentData.map(item => 
        item.id === newRecord.id ? newRecord : item
      ).sort((a, b) => 
        new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
      );
      this.queryClient.setQueryData(cacheKey, updatedData);
    } else if (eventType === 'DELETE' && oldRecord) {
      const filteredData = currentData.filter(item => item.id !== oldRecord.id);
      this.queryClient.setQueryData(cacheKey, filteredData);
    }
  }

  private updateDeliveryOrderItemsCache(eventType: string, newRecord: any, oldRecord: any): void {
    if (!this.queryClient || !this.companyId) return;

    const cacheKey = ['delivery_order_items', this.companyId];
    const currentData = this.queryClient.getQueryData<any[]>(cacheKey) || [];

    if (eventType === 'INSERT' && newRecord) {
      this.queryClient.setQueryData(cacheKey, [...currentData, newRecord]);
    } else if (eventType === 'UPDATE' && newRecord) {
      const updatedData = currentData.map(item => 
        item.id === newRecord.id ? newRecord : item
      );
      this.queryClient.setQueryData(cacheKey, updatedData);
    } else if (eventType === 'DELETE' && oldRecord) {
      const filteredData = currentData.filter(item => item.id !== oldRecord.id);
      this.queryClient.setQueryData(cacheKey, filteredData);
    }
  }

  private async updateWastageLogCache(eventType: string, newRecord: any, oldRecord: any): Promise<void> {
    if (!this.queryClient || !this.companyId) return;

    const cacheKey = ['wastage_log', this.companyId];
    const currentData = this.queryClient.getQueryData<any[]>(cacheKey) || [];

    if (eventType === 'INSERT' && newRecord) {
      // Enrich with ingredient data if missing
      if (newRecord.ingredient_id && !newRecord.ingredient) {
        try {
          const ingredientsCache = this.queryClient.getQueryData<any[]>(['ingredients', this.companyId]) || [];
          const ingredientFromCache = ingredientsCache.find(ing => ing.id === newRecord.ingredient_id);
          
          if (ingredientFromCache) {
            newRecord.ingredient = {
              name: ingredientFromCache.name,
              supplier: ingredientFromCache.supplier,
              known_as: ingredientFromCache.known_as,
              portion_type: ingredientFromCache.portion_type,
              cost_price: ingredientFromCache.cost_price,
              purchase_price: ingredientFromCache.purchase_price,
              purchase_size: ingredientFromCache.purchase_size,
              purchase_type: ingredientFromCache.purchase_type,
              portion_size: ingredientFromCache.portion_size,
              units_per_purchase: ingredientFromCache.units_per_purchase,
            };
          } else {
            // Fetch ingredient details as fallback
            const { data: ingredientData } = await supabase
              .from('ingredients')
              .select('name, supplier, known_as, portion_type, cost_price, purchase_price, purchase_size, purchase_type, portion_size, units_per_purchase')
              .eq('id', newRecord.ingredient_id)
              .single();
            
            if (ingredientData) {
              newRecord.ingredient = ingredientData;
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not enrich wastage log with ingredient:', error);
        }
      }

      const updatedData = [newRecord, ...currentData].sort((a, b) => 
        new Date(b.wastage_time).getTime() - new Date(a.wastage_time).getTime()
      ).slice(0, 500); // Keep last 500 entries
      this.queryClient.setQueryData(cacheKey, updatedData);
    } else if (eventType === 'UPDATE' && newRecord) {
      const updatedData = currentData.map(item => 
        item.id === newRecord.id ? newRecord : item
      ).sort((a, b) => 
        new Date(b.wastage_time).getTime() - new Date(a.wastage_time).getTime()
      );
      this.queryClient.setQueryData(cacheKey, updatedData);
    } else if (eventType === 'DELETE' && oldRecord) {
      const filteredData = currentData.filter(item => item.id !== oldRecord.id);
      this.queryClient.setQueryData(cacheKey, filteredData);
    }
  }

  private updateGenericCache(tableName: string, eventType: string, newRecord: any, oldRecord: any): void {
    if (!this.queryClient || !this.companyId) return;

    const cacheKey = [tableName, this.companyId];
    const currentData = this.queryClient.getQueryData<any[]>(cacheKey) || [];

    if (eventType === 'INSERT' && newRecord) {
      // For tables specifically, maintain sort order by table_number
      if (tableName === 'tables') {
        const updatedData = [...currentData, newRecord].sort((a, b) => a.table_number - b.table_number);
        this.queryClient.setQueryData(cacheKey, updatedData);
      } else if (tableName === 'menu_items') {
        // For menu items, maintain sort order by name
        const updatedData = [...currentData, newRecord].sort((a, b) => 
          (a.name || '').localeCompare(b.name || '')
        );
        this.queryClient.setQueryData(cacheKey, updatedData);
      } else if (tableName === 'ingredients') {
        // For ingredients, maintain sort order by name and filter by is_active
        if (newRecord.is_active) {
          const updatedData = [...currentData, newRecord].sort((a, b) => 
            (a.name || '').localeCompare(b.name || '')
          );
          this.queryClient.setQueryData(cacheKey, updatedData);
        }
      } else {
        this.queryClient.setQueryData(cacheKey, [...currentData, newRecord]);
      }
    } else if (eventType === 'UPDATE' && newRecord) {
      const updatedData = currentData.map(item => 
        item.id === newRecord.id ? newRecord : item
      );
      // For tables, re-sort in case table_number changed
      if (tableName === 'tables') {
        this.queryClient.setQueryData(cacheKey, updatedData.sort((a, b) => a.table_number - b.table_number));
      } else if (tableName === 'menu_items') {
        // For menu items, re-sort in case name changed
        this.queryClient.setQueryData(cacheKey, updatedData.sort((a, b) => 
          (a.name || '').localeCompare(b.name || '')
        ));
      } else if (tableName === 'ingredients') {
        // For ingredients, re-sort and filter by is_active
        if (newRecord.is_active) {
          this.queryClient.setQueryData(cacheKey, updatedData.sort((a, b) => 
            (a.name || '').localeCompare(b.name || '')
          ));
        } else {
          // Remove from list if marked inactive
          const filteredData = currentData.filter(item => item.id !== newRecord.id);
          this.queryClient.setQueryData(cacheKey, filteredData);
        }
      } else {
        this.queryClient.setQueryData(cacheKey, updatedData);
      }
    } else if (eventType === 'DELETE' && oldRecord) {
      const filteredData = currentData.filter(item => item.id !== oldRecord.id);
      this.queryClient.setQueryData(cacheKey, filteredData);
    }
  }

  private updateMenuItemsCache(eventType: string, newRecord: any, oldRecord: any): void {
    if (!this.queryClient || !this.companyId) return;

    const cacheKey = ['menu_items', this.companyId];
    const currentData = this.queryClient.getQueryData<any[]>(cacheKey) || [];

    if (eventType === 'INSERT' && newRecord) {
      // For new items, preserve category_type if present, otherwise fallback
      const itemToAdd = {
        ...newRecord,
        category_type: newRecord.category_type || 'mains'
      };
      const updatedData = [...currentData, itemToAdd].sort((a, b) => 
        (a.display_order || 999) - (b.display_order || 999)
      );
      this.queryClient.setQueryData(cacheKey, updatedData);
      console.log(`✅ Added menu item ${newRecord.name} to cache`);
      
    } else if (eventType === 'UPDATE' && newRecord) {
      // Preserve category_type from existing cache when updating
      const existingItem = currentData.find(item => item.id === newRecord.id);
      const updatedItem = {
        ...newRecord,
        category_type: newRecord.category_type || existingItem?.category_type || 'mains'
      };
      
      const updatedData = currentData.map(item => 
        item.id === newRecord.id ? updatedItem : item
      ).sort((a, b) => 
        (a.display_order || 999) - (b.display_order || 999)
      );
      
      this.queryClient.setQueryData(cacheKey, updatedData);
      console.log(`✅ Updated menu item ${newRecord.name} in cache`);
      
    } else if (eventType === 'DELETE' && oldRecord) {
      const filteredData = currentData.filter(item => item.id !== oldRecord.id);
      this.queryClient.setQueryData(cacheKey, filteredData);
      console.log(`✅ Removed menu item from cache`);
    }
  }

  private handleConnectionError(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🚀 Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🚀 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.isActive && this.companyId) {
        this.stop();
        this.start(this.companyId);
      }
    }, delay);
  }

  private setupCachePersistenceListener(): void {
    if (!this.queryClient) return;
    
    console.log('📡 Setting up global cache persistence listener');
    
    this.queryClient.getQueryCache().subscribe((event) => {
      if (event?.type !== 'updated') return;
      
      const query = event.query;
      const queryKey = query.queryKey as string[];
      const data = query.state.data;
      
      if (!queryKey || !this.companyId) return;
      if (!queryKey.includes(this.companyId)) return;
      if (!this.isActive) return;
      
      this.persistenceQueue.set(queryKey.join('::'), { queryKey, data });
      this.persistCacheDebounced();
    });
  }

  private persistCacheDebounced(): void {
    if (this.persistenceDebounceTimer) {
      clearTimeout(this.persistenceDebounceTimer);
    }
    
    this.persistenceDebounceTimer = setTimeout(async () => {
      if (this.persistenceQueue.size === 0) return;
      
      console.log(`💾 Persisting ${this.persistenceQueue.size} cache updates to IndexedDB...`);
      
      for (const [_, item] of this.persistenceQueue.entries()) {
        await OfflineStorage.saveCache(item.queryKey, item.data, this.companyId!);
      }
      
      this.persistenceQueue.clear();
    }, 2000);
  }

  stop(): void {
    console.log('🚀 Stopping DeviceDataManager');
    this.isActive = false;
    
    // Stop session heartbeat
    if (this.sessionHeartbeat) {
      clearInterval(this.sessionHeartbeat);
      this.sessionHeartbeat = null;
    }
    
    if (this.persistenceDebounceTimer) {
      clearTimeout(this.persistenceDebounceTimer);
    }
    
    if (this.orientationChangeHandler) {
      window.removeEventListener('device-orientation-changed', this.orientationChangeHandler);
      this.orientationChangeHandler = null;
    }
    
    this.subscriptions.forEach(sub => {
      sub.cleanup();
    });
    this.subscriptions = [];
    this.companyId = null;
  }

  getCompanyId(): string | null {
    return this.companyId;
  }

  isRunning(): boolean {
    return this.isActive;
  }

  private shouldUseEdgeFunctions(): boolean {
    // Use edge functions for ALL bound devices
    // Edge functions bypass RLS using service role key
    return isDeviceBound();
  }

  // Public lightweight integrity check to repair missing critical caches without a restart
  async ensureCriticalCaches(companyIdParam?: string): Promise<void> {
    if (!this.queryClient) return;
    const bound = getBoundCompany();
    const companyId = companyIdParam || this.companyId || bound?.company_id;
    if (!companyId) return;
    await this.checkAndRepairCriticalCaches(companyId);
  }

  private _isRepairing = false;

  private async checkAndRepairCriticalCaches(companyId: string): Promise<void> {
    if (!this.queryClient) return;
    if (this._isRepairing) return;
    this._isRepairing = true;
    const started = performance.now();

    try {
      const qc = this.queryClient;
      const checks: Array<{ key: [string, string], name: string, repair: () => Promise<void> }> = [
        { key: ['tables', companyId], name: 'tables', repair: () => this.seedTablesCache() },
        { key: ['table_groups', companyId], name: 'table_groups', repair: () => this.seedTableGroupsCache() },
        { key: ['customers', companyId], name: 'customers', repair: () => this.seedCustomersCache() },
        { key: ['menu_items', companyId], name: 'menu_items', repair: () => this.seedMenuItemsCache() },
        { key: ['menu_categories', companyId], name: 'menu_categories', repair: () => this.seedMenuCategoriesCache() },
        { key: ['orders', companyId], name: 'orders', repair: () => this.seedOrdersCache() },
        { key: ['open-tabs', companyId], name: 'open_tabs', repair: () => this.seedOpenTabsCache() },
      ];

      const missing: string[] = [];
      for (const c of checks) {
        const data = qc.getQueryData(c.key as any);
        if (!data || (Array.isArray(data) && data.length === 0)) missing.push(c.name);
      }

      if (missing.length === 0) {
        console.log('🧩 DeviceDataManager: Critical caches OK');
        return;
      }

      console.warn('🧩 DeviceDataManager: Repairing missing caches:', missing);
      // Run repairs in parallel
      await Promise.all(
        checks
          .filter(c => missing.includes(c.name))
          .map(c => c.repair().catch(err => console.error(`Repair failed for ${c.name}`, err)))
      );

      const ms = Math.round(performance.now() - started);
      console.log(`🧩 DeviceDataManager: Repair complete in ${ms}ms →`, missing);
    } finally {
      this._isRepairing = false;
    }
  }

  // Comprehensive data seeding for instant app experience
  private async seedInitialCache() {
    if (!this.queryClient || !this.companyId) return;
    
    console.log('🌱 Starting CRITICAL cache seed for company:', this.companyId);
    const startTime = performance.now();
    
    try {
      // PHASE 1: Load critical data immediately for fast login
      const [
        reservationsResult,
        tablesResult,
        tableGroupsResult,
        settingsResult,
        dealsResult,
        customersResult,
        menuItemsResult,
        productLinksResult,
        menuItemIngredientsResult,
        ordersResult,
        openTabsResult,
        suppliersResult,
        deliveryOrdersResult,
        deliveryOrderItemsResult,
        wastageLogResult,
        deliverySettingsResult,
        ingredientsResult,
      ] = await Promise.allSettled([
        this.seedReservationsCache(),
        this.seedTablesCache(),
        this.seedTableGroupsCache(),
        this.seedCompanySettingsCache(),
        this.seedDealsCache(),
        this.seedCustomersCache(),
        this.seedMenuItemsCache(),
        this.seedProductLinksCache(),
        this.seedMenuItemIngredientsCache(),
        this.seedOrdersCache(),
        this.seedOpenTabsCache(),
        this.seedSuppliersCache(),
        this.seedDeliveryOrdersCache(),
        this.seedDeliveryOrderItemsCache(),
        this.seedWastageLogCache(),
        this.seedDeliverySettingsCache(),
        this.seedIngredientsCache(),
      ]);

      const criticalResults = [
        { name: 'reservations', result: reservationsResult },
        { name: 'tables', result: tablesResult },
        { name: 'table_groups', result: tableGroupsResult },
        { name: 'settings', result: settingsResult },
        { name: 'deals', result: dealsResult },
        { name: 'customers', result: customersResult },
        { name: 'menu_items', result: menuItemsResult },
        { name: 'product_links', result: productLinksResult },
        { name: 'menu_item_ingredients', result: menuItemIngredientsResult },
        { name: 'orders', result: ordersResult },
        { name: 'open_tabs', result: openTabsResult },
        { name: 'suppliers', result: suppliersResult },
        { name: 'delivery_orders', result: deliveryOrdersResult },
        { name: 'delivery_order_items', result: deliveryOrderItemsResult },
        { name: 'wastage_log', result: wastageLogResult },
        { name: 'delivery_settings', result: deliverySettingsResult },
        { name: 'ingredients', result: ingredientsResult },
      ];

      const criticalSuccessful = criticalResults.filter(r => r.result.status === 'fulfilled').length;
      const criticalFailed = criticalResults.filter(r => r.result.status === 'rejected');
      
      const criticalDuration = Math.round(performance.now() - startTime);
      console.log(`⚡ CRITICAL cache seeded: ${criticalSuccessful}/${criticalResults.length} in ${criticalDuration}ms`);
      
      if (criticalFailed.length > 0) {
        console.warn('⚠️ Critical seed failures:', criticalFailed.map(f => f.name));
        
        // RETRY critical failures after 2 seconds
        setTimeout(async () => {
          console.log('🔄 Retrying critical seed failures...');
          const retryPromises = criticalFailed.map(async (failed) => {
            try {
              switch (failed.name) {
                case 'tables':
                  await this.seedTablesCache();
                  break;
                case 'table_groups':
                  await this.seedTableGroupsCache();
                  break;
                case 'menu_items':
                  await this.seedMenuItemsCache();
                  break;
                case 'customers':
                  await this.seedCustomersCache();
                  break;
                case 'settings':
                  await this.seedCompanySettingsCache();
                  break;
                case 'deals':
                  await this.seedDealsCache();
                  break;
                case 'reservations':
                  await this.seedReservationsCache();
                  break;
                case 'product_links':
                  await this.seedProductLinksCache();
                  break;
                case 'menu_item_ingredients':
                  await this.seedMenuItemIngredientsCache();
                  break;
                case 'orders':
                  await this.seedOrdersCache();
                  break;
                case 'open_tabs':
                  await this.seedOpenTabsCache();
                  break;
                case 'suppliers':
                  await this.seedSuppliersCache();
                  break;
                case 'delivery_orders':
                  await this.seedDeliveryOrdersCache();
                  break;
                case 'delivery_order_items':
                  await this.seedDeliveryOrderItemsCache();
                  break;
                case 'wastage_log':
                  await this.seedWastageLogCache();
                  break;
                case 'delivery_settings':
                  await this.seedDeliverySettingsCache();
                  break;
                case 'ingredients':
                  await this.seedIngredientsCache();
                  break;
              }
              return { success: true, name: failed.name };
            } catch (error) {
              console.error(`🔄 Retry failed for ${failed.name}:`, error);
              return { success: false, name: failed.name };
            }
          });
          
          const retryResults = await Promise.allSettled(retryPromises);
          const retrySuccessful = retryResults.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
          console.log(`🔄 Retry results: ${retrySuccessful}/${criticalFailed.length} succeeded`);
        }, 2000);
      }

      // PHASE 2: Defer non-critical data to prevent blocking login
      setTimeout(async () => {
        console.log('📦 Starting NON-CRITICAL cache seed (deferred)');
        const deferredStart = performance.now();
        
        const [
          menuCategoriesResult,
          usersResult,
          locationsResult,
          inventoryResult,
          campaignsResult,
          integrationsResult,
          pagePermissionsResult
        ] = await Promise.allSettled([
          this.seedMenuCategoriesCache(),
          this.seedUsersCache(),
          this.seedLocationsCache(),
          this.seedInventoryCache(),
          this.seedMarketingCampaignsCache(),
          this.seedIntegrationsCache(),
          this.seedPagePermissionsCache()
        ]);

        const deferredResults = [
          { name: 'menu_categories', result: menuCategoriesResult },
          { name: 'users', result: usersResult },
          { name: 'locations', result: locationsResult },
          { name: 'inventory', result: inventoryResult },
          { name: 'campaigns', result: campaignsResult },
          { name: 'integrations', result: integrationsResult },
          { name: 'page_permissions', result: pagePermissionsResult }
        ];

        const deferredSuccessful = deferredResults.filter(r => r.result.status === 'fulfilled').length;
        const deferredFailed = deferredResults.filter(r => r.result.status === 'rejected');
        
        const deferredDuration = Math.round(performance.now() - deferredStart);
        console.log(`📦 NON-CRITICAL cache seeded: ${deferredSuccessful}/${deferredResults.length} in ${deferredDuration}ms`);
        
        if (deferredFailed.length > 0) {
          console.warn('📦 Non-critical seed failures (expected):', deferredFailed.map(f => f.name));
        }
      }, 1000); // 1 second delay to allow login to complete

    } catch (error) {
      console.error('🌱 Critical cache seeding failed:', error);
    }
  }

  private async seedTablesCache() {
    try {
      // Prefer edge function for device-bound (PIN) flow to bypass RLS
      if (isDeviceBound() && this.companyId) {
        console.log('🏪 Seeding tables via edge function (device-bound)');
        const { data: resp, error: fnError } = await supabase.functions.invoke('pin-tables-fetch', {
          body: { companyId: this.companyId, isDeviceBound: true },
        });

        if (!fnError && resp?.success) {
          const tablesData = resp.tables || [];
          const formattedTables = tablesData.map((table: any) => ({
            id: table.id,
            company_id: table.company_id,
            table_number: table.table_number,
            table_name: table.table_name,
            seats: table.seats,
            accessibility_friendly: table.accessibility_friendly,
            service_status: (table.service_status || 'available') as 'available' | 'out_of_service' | 'temporarily_removed',
            is_active: table.is_active,
            status: table.status || 'active',
            created_at: table.created_at,
          }));

          this.queryClient!.setQueryData(['tables', this.companyId], formattedTables);
          console.log(`🌱 Seeded ${formattedTables.length} tables (edge function)`);
          return;
        } else {
          console.warn('🏪 Edge function tables seed failed, falling back to direct query', fnError || resp);
        }
      }

      // Fallback: direct query (works when authenticated via owner login)
      const { data: tablesData, error } = await supabase
        .from('tables')
        .select('*')
        .eq('company_id', this.companyId)
        .order('table_number', { ascending: true });

      if (error) {
        console.error('❌ Failed to seed tables:', error);
        throw error;
      }

      if (tablesData) {
        const formattedTables = tablesData.map((table: any) => ({
          id: table.id,
          company_id: table.company_id,
          table_number: table.table_number,
          table_name: table.table_name,
          seats: table.seats,
          accessibility_friendly: table.accessibility_friendly,
          service_status: (table.service_status || 'available') as 'available' | 'out_of_service' | 'temporarily_removed',
          is_active: table.is_active,
          status: table.status || 'active',
          created_at: table.created_at,
        }));

        this.queryClient!.setQueryData(['tables', this.companyId], formattedTables);
        console.log(`🌱 Seeded ${formattedTables.length} tables (direct query)`);
      }
    } catch (error) {
      console.error('❌ Exception seeding tables:', error);
      throw error;
    }
  }

  private async seedCompanySettingsCache() {
    try {
      const { data: settingsData, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', this.companyId)
        .single();

      if (error) {
        console.error('❌ Failed to seed company settings:', error);
        throw error;
      }

      if (settingsData) {
        this.queryClient!.setQueryData(['company_settings', this.companyId], settingsData);
        console.log('🌱 Seeded company settings');
      }
    } catch (error) {
      console.error('❌ Exception seeding company settings:', error);
      throw error;
    }
  }

  private async seedMenuItemsCache() {
    try {
      const useEdgeFunctions = this.shouldUseEdgeFunctions();
      
      if (useEdgeFunctions) {
        // Use PIN-based edge function - bound device doesn't need rawPin
        const { data, error } = await supabase.functions.invoke('pin-menu-items-fetch', {
          body: { companyId: this.companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ Failed to seed menu items via PIN edge function:', error);
          return; // Don't throw, just log and keep existing cache
        }

        if (data.items && data.items.length > 0) {
          this.queryClient!.setQueryData(['menu_items', this.companyId], data.items);
          console.log(`🌱 Seeded ${data.items.length} menu items (bound device mode)`);
        } else {
          const existing = this.queryClient!.getQueryData(['menu_items', this.companyId]);
          if (existing && Array.isArray(existing) && existing.length > 0) {
            console.warn('⚠️ Received 0 menu items, keeping existing cache');
          } else {
            console.warn('⚠️ No menu items available and no existing cache');
          }
        }
      } else {
        // Standard authenticated query
        const { data: menuData, error } = await supabase
          .from('menu_items')
          .select(`
            *,
            menu_categories!inner (
              category_type
            )
          `)
          .eq('company_id', this.companyId)
          .order('display_order', { ascending: true });

        if (error) {
          console.error('❌ Failed to seed menu items:', error);
          return;
        }

        if (menuData && menuData.length > 0) {
          const transformedData = menuData.map(({ menu_categories, ...item }: any) => ({
            ...item,
            category_type: menu_categories?.category_type || 'mains'
          }));
          
          this.queryClient!.setQueryData(['menu_items', this.companyId], transformedData);
          console.log(`🌱 Seeded ${transformedData.length} menu items with category types`);
        }
      }
    } catch (error) {
      console.error('❌ Exception seeding menu items:', error);
    }
  }

  private async seedMenuCategoriesCache() {
    try {
      const useEdgeFunctions = this.shouldUseEdgeFunctions();
      
      if (useEdgeFunctions) {
        // Use PIN-based edge function - bound device doesn't need rawPin
        const { data, error } = await supabase.functions.invoke('pin-menu-categories-fetch', {
          body: { companyId: this.companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ Failed to seed menu categories via PIN edge function:', error);
          return; // Don't throw, just log and keep existing cache
        }

        if (data.categories && data.categories.length > 0) {
          // Organize into hierarchical structure
          const allCategories = data.categories;
          const categoriesWithSubcategories = allCategories
            .filter((cat: any) => !cat.parent_id)
            .map((category: any) => ({
              ...category,
              subcategories: allCategories.filter((sub: any) => sub.parent_id === category.id)
            }));
          
          this.queryClient!.setQueryData(['menu_categories', this.companyId], categoriesWithSubcategories);
          console.log(`🌱 Seeded ${categoriesWithSubcategories.length} menu categories (bound device mode)`);
        } else {
          const existing = this.queryClient!.getQueryData(['menu_categories', this.companyId]);
          if (existing && Array.isArray(existing) && existing.length > 0) {
            console.warn('⚠️ Received 0 menu categories, keeping existing cache');
          } else {
            console.warn('⚠️ No menu categories available and no existing cache');
          }
        }
      } else {
        // Standard authenticated query
        const { data: categoriesData, error } = await supabase
          .from('menu_categories')
          .select('*')
          .eq('company_id', this.companyId)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (error) {
          console.error('❌ Failed to seed menu categories:', error);
          return;
        }

        if (categoriesData) {
          // Organize into hierarchical structure
          const categoriesWithSubcategories = categoriesData
            .filter(cat => !cat.parent_id)
            .map(category => ({
              ...category,
              subcategories: categoriesData.filter(sub => sub.parent_id === category.id)
            }));
          
          this.queryClient!.setQueryData(['menu_categories', this.companyId], categoriesWithSubcategories);
          console.log(`🌱 Seeded ${categoriesWithSubcategories.length} menu categories`);
        }
      }
    } catch (error) {
      console.error('❌ Exception seeding menu categories:', error);
    }
  }

  private async seedProductLinksCache() {
    try {
      let grouped: Record<string, any[]> = {};

      // Use edge function for bound devices, direct query for web users
      if (this.shouldUseEdgeFunctions()) {
        console.log('🔌 Fetching product links via edge function (bound device)');
        const { data, error } = await supabase.functions.invoke('pin-product-links-fetch', {
          body: {
            pin: getRawPin(),
            companyId: this.companyId,
            isDeviceBound: true
          }
        });

        if (error || !data?.success) {
          console.error('❌ Failed to seed product links via edge function:', error || data?.error);
          throw new Error(data?.error || 'Edge function failed');
        }

        grouped = data.productLinks || {};
      } else {
        console.log('🔌 Fetching product links via direct query (web user)');
        const { data: productLinksData, error } = await supabase
          .from('product_links')
          .select('*')
          .eq('company_id', this.companyId)
          .eq('is_active', true);

        if (error) {
          console.error('❌ Failed to seed product links:', error);
          throw error;
        }

        if (productLinksData) {
          // Group by menu_item_id (same format as the hook expects)
          productLinksData.forEach((link) => {
            if (!grouped[link.menu_item_id]) {
              grouped[link.menu_item_id] = [];
            }
            grouped[link.menu_item_id].push(link);
          });
        }
      }

      this.queryClient!.setQueryData(['menu-item-product-links', this.companyId], grouped);
      const totalLinks = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
      console.log(`🌱 Seeded ${totalLinks} product links for ${Object.keys(grouped).length} menu items`);
    } catch (error) {
      console.error('❌ Exception seeding product links:', error);
      // Don't throw - allow app to continue with cached data
    }
  }

  private async seedMenuItemIngredientsCache() {
    try {
      const useEdgeFunctions = this.shouldUseEdgeFunctions();
      let data = null;

      if (useEdgeFunctions) {
        console.log('🔧 Using edge function for menu_item_ingredients (device bound)');
        // Direct query is acceptable here as it's internal device operation
        const result = await supabase
          .from('menu_item_ingredients')
          .select('*')
          .eq('company_id', this.companyId)
          .order('display_order', { ascending: true });
        data = result.data;
        if (result.error) throw result.error;
      } else {
        const { data: fetchedData, error } = await supabase
          .from('menu_item_ingredients')
          .select('*')
          .eq('company_id', this.companyId)
          .order('display_order', { ascending: true });
        if (error) throw error;
        data = fetchedData;
      }

      if (!data) {
        console.log('✅ No menu_item_ingredients to seed');
        return;
      }

      if (data && data.length > 0) {
        // Group ingredients by menu_item_id
        const ingredientsByMenuItem = data.reduce((acc: Record<string, any[]>, ingredient: any) => {
          if (!acc[ingredient.menu_item_id]) {
            acc[ingredient.menu_item_id] = [];
          }
          acc[ingredient.menu_item_id].push(ingredient);
          return acc;
        }, {});

        // Set cache for each menu item
        for (const [menuItemId, ingredients] of Object.entries(ingredientsByMenuItem)) {
          const queryKey = ['menu-item-ingredients', menuItemId];
          this.queryClient!.setQueryData(queryKey, ingredients);
          await OfflineStorage.saveCache(queryKey, ingredients, this.companyId!);
        }

        console.log(`✅ Seeded menu_item_ingredients: ${Object.keys(ingredientsByMenuItem).length} menu items with ingredients`);
      } else {
        console.log('✅ No menu_item_ingredients to seed');
      }
    } catch (error) {
      console.error('❌ Failed to seed menu_item_ingredients:', error);
      throw error;
    }
  }

  private async seedCustomersCache() {
    try {
      const useEdgeFunctions = this.shouldUseEdgeFunctions();
      
      if (useEdgeFunctions) {
        // Use PIN-based edge function - bound device doesn't need rawPin
        const { data, error } = await supabase.functions.invoke('pin-customers-fetch', {
          body: { companyId: this.companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ Failed to seed customers via PIN edge function:', error);
          return;
        }

        const customers = data.customers ?? data.data ?? [];
        if (customers.length > 0) {
          this.queryClient!.setQueryData(['customers', this.companyId], customers);
          console.log(`🌱 Seeded ${customers.length} customers (bound device mode)`);
        } else {
          const existing = this.queryClient!.getQueryData(['customers', this.companyId]);
          if (existing && Array.isArray(existing) && existing.length > 0) {
            console.warn('⚠️ Received 0 customers, keeping existing cache');
          }
        }
      } else {
        // Standard authenticated query
        const { data: customersData, error } = await supabase
          .from('customers')
          .select('*')
          .eq('company_id', this.companyId)
          .order('name', { ascending: true });

        if (error) {
          console.error('❌ Failed to seed customers:', error);
          return;
        }

        if (customersData && customersData.length > 0) {
          this.queryClient!.setQueryData(['customers', this.companyId], customersData);
          console.log(`🌱 Seeded ${customersData.length} customers`);
        }
      }
    } catch (error) {
      console.error('❌ Exception seeding customers:', error);
    }
  }

  private async seedOrdersCache() {
    try {
      const useEdgeFunctions = this.shouldUseEdgeFunctions();
      
      if (useEdgeFunctions) {
        const { data, error } = await supabase.functions.invoke('pin-orders-fetch', {
          body: { companyId: this.companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ Failed to seed orders via PIN edge function:', error);
          return;
        }

        const orders = data.orders ?? [];
        if (orders.length > 0) {
          const parsedOrders = orders.map((order: any) => ({
            ...order,
            order_items: order.order_items?.map((item: any) => ({
              ...item,
              modifications: typeof item.modifications === 'string' ? JSON.parse(item.modifications) : item.modifications
            }))
          }));
          this.queryClient!.setQueryData(['kitchen-orders', this.companyId], parsedOrders);
          console.log(`🌱 Seeded ${parsedOrders.length} orders (bound device mode)`);
        }
      } else {
        const { data: ordersData, error } = await supabase
          .from('orders')
          .select(`
            id,
            external_pos_order_id,
            table_number,
            customer_name,
            created_at,
            scheduled_for,
            assignment_type,
            current_course_started_at,
            reservation_id,
            kitchen_status,
            total_amount,
            status,
            reservation:reservations (id, status, customer_name),
            order_items (id, quantity, unit_price, subtotal, course_type, is_prepared, modifications, notes, menu_items (id, name, category_id))
          `)
          .eq('company_id', this.companyId)
          .in('kitchen_status', ['sent', 'preparing'])
          .order('created_at', { ascending: true })
          .limit(100);

        if (error) {
          console.error('❌ Failed to seed orders:', error);
          return;
        }

        if (ordersData && ordersData.length > 0) {
          const parsedOrders = ordersData.map(order => ({
            ...order,
            order_items: order.order_items?.map(item => ({
              ...item,
              modifications: typeof item.modifications === 'string' ? JSON.parse(item.modifications) : item.modifications
            }))
          }));
          
          this.queryClient!.setQueryData(['kitchen-orders', this.companyId], parsedOrders);
          console.log(`🌱 Seeded ${parsedOrders.length} kitchen orders`);
        }
      }
    } catch (error) {
      console.error('❌ Exception seeding orders:', error);
    }
  }

  private async seedOpenTabsCache() {
    try {
      const { data: openTabsData, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          assignment_type,
          table_number,
          customer_name,
          total_amount,
          amount_paid,
          created_at,
          order_items (
            id,
            quantity
          ),
          payments (
            split_index,
            total_splits
          )
        `)
        .eq('company_id', this.companyId)
        .eq('payment_status', 'unpaid')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('❌ Failed to seed open tabs:', error);
        throw error;
      }

      // Transform raw data into OpenTab format before caching
      const transformedTabs = openTabsData?.map(order => {
        const splitPayments = order.payments?.filter((p: any) => p.total_splits !== null) || [];
        const isSplit = splitPayments.length > 0;
        
        return {
          orderId: order.id,
          orderNumber: order.order_number,
          assignmentType: order.assignment_type as 'table' | 'customer_name',
          tableNumber: order.table_number || undefined,
          customerName: order.customer_name || undefined,
          itemCount: order.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0,
          totalAmount: order.total_amount || 0,
          amountPaid: order.amount_paid || 0,
          createdAt: order.created_at,
          isSplit,
          totalSplits: isSplit ? splitPayments[0].total_splits : 0,
          paidSplits: isSplit ? new Set(splitPayments.map((p: any) => p.split_index)).size : 0,
        };
      }) || [];

      this.queryClient!.setQueryData(['open-tabs', this.companyId], transformedTabs);
      console.log(`🌱 Seeded ${transformedTabs.length} open tabs (transformed format)`);
    } catch (error) {
      console.error('❌ Exception seeding open tabs:', error);
      throw error;
    }
  }

  private async seedSuppliersCache() {
    try {
      const useEdgeFunctions = this.shouldUseEdgeFunctions();
      
      if (useEdgeFunctions) {
        const { data, error } = await supabase.functions.invoke('pin-suppliers-fetch', {
          body: { companyId: this.companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ Failed to seed suppliers via edge function:', error);
          return;
        }

        const suppliers = data.suppliers || [];
        this.queryClient!.setQueryData(['suppliers', this.companyId], suppliers);
        console.log(`🌱 Seeded ${suppliers.length} suppliers (bound device mode)`);
      } else {
        const { data, error } = await supabase
          .from('suppliers' as any)
          .select('*')
          .eq('company_id', this.companyId)
          .order('name');

        if (error) {
          console.error('❌ Failed to seed suppliers:', error);
          return;
        }

        if (data) {
          this.queryClient!.setQueryData(['suppliers', this.companyId], data);
          console.log(`🌱 Seeded ${data.length} suppliers`);
        }
      }
    } catch (error) {
      console.error('❌ Exception seeding suppliers:', error);
    }
  }

  private async seedIngredientsCache() {
    try {
      const useEdgeFunctions = this.shouldUseEdgeFunctions();
      
      if (useEdgeFunctions) {
        const { data, error } = await supabase.functions.invoke('pin-ingredients-fetch', {
          body: { companyId: this.companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ Failed to seed ingredients via edge function:', error);
          return;
        }

        const ingredients = data.ingredients || [];
        this.queryClient!.setQueryData(['ingredients', this.companyId], ingredients);
        console.log(`🌱 Seeded ${ingredients.length} ingredients (bound device mode)`);
      } else {
        const { data, error } = await supabase
          .from('ingredients' as any)
          .select('*')
          .eq('company_id', this.companyId)
          .eq('is_active', true)
          .order('name');

        if (error) {
          console.error('❌ Failed to seed ingredients:', error);
          return;
        }

        if (data) {
          this.queryClient!.setQueryData(['ingredients', this.companyId], data);
          console.log(`🌱 Seeded ${data.length} ingredients`);
        }
      }
    } catch (error) {
      console.error('❌ Exception seeding ingredients:', error);
    }
  }

  private async seedDeliveryOrdersCache() {
    try {
      const useEdgeFunctions = this.shouldUseEdgeFunctions();
      
      if (useEdgeFunctions) {
        const { data, error } = await supabase.functions.invoke('pin-delivery-orders-fetch', {
          body: { companyId: this.companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ Failed to seed delivery orders via edge function:', error);
          return;
        }

        const orders = data.orders || [];
        this.queryClient!.setQueryData(['delivery_orders', this.companyId], orders);
        console.log(`🌱 Seeded ${orders.length} delivery orders (bound device mode)`);
      } else {
        const { data, error} = await supabase
          .from('delivery_orders' as any)
          .select('*')
          .eq('company_id', this.companyId)
          .order('order_date', { ascending: false });

        if (error) {
          console.error('❌ Failed to seed delivery_orders:', error);
          return;
        }

        if (data) {
          this.queryClient!.setQueryData(['delivery_orders', this.companyId], data);
          console.log(`🌱 Seeded ${data.length} delivery orders`);
        }
      }
    } catch (error) {
      console.error('❌ Exception seeding delivery orders:', error);
    }
  }

  private async seedDeliveryOrderItemsCache() {
    try {
      const useEdgeFunctions = this.shouldUseEdgeFunctions();
      
      if (useEdgeFunctions) {
        const { data, error } = await supabase.functions.invoke('pin-delivery-order-items-fetch', {
          body: { companyId: this.companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ Failed to seed delivery order items via edge function:', error);
          return;
        }

        const items = data.orderItems || [];
        this.queryClient!.setQueryData(['delivery_order_items', this.companyId], items);
        console.log(`🌱 Seeded ${items.length} delivery order items (bound device mode)`);
      } else {
        const { data, error } = await supabase
          .from('delivery_order_items' as any)
          .select('*')
          .eq('company_id', this.companyId);

        if (error) {
          console.error('❌ Failed to seed delivery_order_items:', error);
          return;
        }

        if (data) {
          this.queryClient!.setQueryData(['delivery_order_items', this.companyId], data);
          console.log(`🌱 Seeded ${data.length} delivery order items`);
        }
      }
    } catch (error) {
      console.error('❌ Exception seeding delivery order items:', error);
    }
  }

  private async seedWastageLogCache() {
    try {
      const useEdgeFunctions = this.shouldUseEdgeFunctions();
      
      if (useEdgeFunctions) {
        const { data, error } = await supabase.functions.invoke('pin-wastage-fetch', {
          body: { companyId: this.companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ Failed to seed wastage log via edge function:', error);
          return;
        }

        const wastageLog = data.wastageLog || [];
        this.queryClient!.setQueryData(['wastage_log', this.companyId], wastageLog);
        console.log(`🌱 Seeded ${wastageLog.length} wastage log entries (bound device mode)`);
      } else {
        const { data, error } = await supabase
          .from('wastage_log' as any)
          .select(`
            *,
            ingredient:ingredients(
              name, 
              supplier, 
              known_as, 
              portion_type,
              cost_price,
              purchase_price,
              purchase_size,
              purchase_type,
              portion_size,
              units_per_purchase
            )
          `)
          .eq('company_id', this.companyId)
          .order('wastage_time', { ascending: false })
          .limit(500);

        if (error) {
          console.error('❌ Failed to seed wastage_log:', error);
          return;
        }

        if (data) {
          this.queryClient!.setQueryData(['wastage_log', this.companyId], data);
          console.log(`🌱 Seeded ${data.length} wastage log entries`);
        }
      }
    } catch (error) {
      console.error('❌ Exception seeding wastage log:', error);
    }
  }

  private async seedDeliverySettingsCache() {
    try {
      const { data, error } = await supabase
        .from('delivery_settings' as any)
        .select('*')
        .eq('company_id', this.companyId)
        .maybeSingle();

      if (error) {
        console.error('❌ Failed to seed delivery_settings:', error);
        throw error;
      }

      if (data) {
        this.queryClient!.setQueryData(['delivery_settings', this.companyId], data);
        console.log('🌱 Seeded delivery settings');
      }
    } catch (error) {
      console.error('❌ Exception seeding delivery settings:', error);
      throw error;
    }
  }

  private async seedUsersCache() {
    try {
      const useEdgeFunctions = this.shouldUseEdgeFunctions();
      console.log(`🔧 Seeding users cache (useEdgeFunctions: ${useEdgeFunctions})`);
      
      if (useEdgeFunctions) {
        const { data, error } = await supabase.functions.invoke('pin-users-fetch', {
          body: { companyId: this.companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ Failed to seed users via PIN edge function:', error);
          return;
        }

        const users = data.users ?? [];
        if (users.length > 0) {
          this.queryClient!.setQueryData(['users', this.companyId], users);
          console.log(`🌱 Seeded ${users.length} users (bound device mode)`);
        }
      } else {
        const { data: usersData, error } = await supabase
          .from('users')
          .select('*')
          .eq('company_id', this.companyId)
          .eq('is_active', true);

        if (error) {
          console.error('❌ Failed to seed users:', error);
          return;
        }

        if (usersData && usersData.length > 0) {
          this.queryClient!.setQueryData(['users', this.companyId], usersData);
          console.log(`🌱 Seeded ${usersData.length} users`);
        }
      }
    } catch (error) {
      console.error('❌ Exception seeding users:', error);
    }
  }

  private async seedLocationsCache() {
    const { data: locationsData } = await supabase
      .from('locations')
      .select('*')
      .eq('company_id', this.companyId);

    if (locationsData) {
      this.queryClient!.setQueryData(['locations', this.companyId], locationsData);
      console.log(`🌱 Seeded ${locationsData.length} locations`);
    }
  }

  private async seedInventoryCache() {
    const { data: inventoryData } = await supabase
      .from('inventory')
      .select('*')
      .eq('company_id', this.companyId);

    if (inventoryData) {
      this.queryClient!.setQueryData(['inventory', this.companyId], inventoryData);
      console.log(`🌱 Seeded ${inventoryData.length} inventory items`);
    }
  }

  private async seedMarketingCampaignsCache() {
    const { data: campaignsData } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('company_id', this.companyId)
      .order('created_at', { ascending: false });

    if (campaignsData) {
      this.queryClient!.setQueryData(['marketing_campaigns', this.companyId], campaignsData);
      console.log(`🌱 Seeded ${campaignsData.length} marketing campaigns`);
    }
  }

  private async seedIntegrationsCache() {
    const { data: integrationsData } = await supabase
      .from('integrations')
      .select('*')
      .eq('company_id', this.companyId);

    if (integrationsData) {
      this.queryClient!.setQueryData(['integrations', this.companyId], integrationsData);
      console.log(`🌱 Seeded ${integrationsData.length} integrations`);
    }
  }

  private async seedReservationsCache(): Promise<void> {
    if (!this.queryClient || !this.companyId) return;
    
    const today = new Date();
    const datesToSeed = [];
    
    // Add previous 3 days
    for (let i = 3; i >= 1; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      datesToSeed.push(date.toISOString().split('T')[0]);
    }
    
    // Add today
    datesToSeed.push(today.toISOString().split('T')[0]);
    
    // Add next 3 days
    for (let i = 1; i <= 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      datesToSeed.push(date.toISOString().split('T')[0]);
    }
    
    try {
      const useEdgeFunctions = this.shouldUseEdgeFunctions();
      let reservationsData;
      
      if (useEdgeFunctions) {
        // Use PIN-based edge function to bypass RLS
        const { getRawPin } = await import('@/utils/pinAuth');
        const rawPin = getRawPin();
        
        const { data, error } = await supabase.functions.invoke('pin-reservations-fetch', {
          body: { pin: rawPin, companyId: this.companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ Failed to seed reservations via PIN edge function:', error);
          return;
        }
        reservationsData = data.reservations;
      } else {
        // Standard authenticated query
        const { data, error: reservationsError } = await supabase
          .from('reservations')
          .select('*')
          .eq('company_id', this.companyId)
          .gte('date', datesToSeed[0])
          .lte('date', datesToSeed[datesToSeed.length - 1])
          .order('date', { ascending: true })
          .order('time', { ascending: true });
        
        if (reservationsError) {
          console.error('❌ Failed to seed reservations cache:', reservationsError);
          return;
        }
        reservationsData = data;
      }
      
      // Group reservations by date and seed cache for each date
      const reservationsByDate = new Map<string, any[]>();
      
      reservationsData?.forEach(reservation => {
        const date = reservation.date;
        if (!reservationsByDate.has(date)) {
          reservationsByDate.set(date, []);
        }
        reservationsByDate.get(date)!.push(reservation);
      });
      
      // Seed cache for each date (including empty dates)
      datesToSeed.forEach(date => {
        const dateReservations = reservationsByDate.get(date) || [];
        const isToday = date === today.toISOString().split('T')[0];
        
        this.queryClient!.setQueryData(['reservations-date', this.companyId, date], {
          date,
          reservations: dateReservations,
          lastUpdated: Date.now(),
          isToday
        });
      });
      
      console.log(`✅ Seeded reservations cache for ${datesToSeed.length} dates`);
    } catch (error) {
      console.error('❌ Error seeding reservations cache:', error);
    }
  }

  private async seedPagePermissionsCache() {
    if (!this.queryClient || !this.companyId) return;
    
    try {
      console.log('🌱 Seeding page_permissions cache...');
      
      const { data, error } = await supabase
        .from('page_permissions')
        .select('id, page_name, access_level, permission_type, company_id, created_at, updated_at')
        .eq('company_id', this.companyId)
        .order('page_name', { ascending: true });
      
      if (error) {
        console.error('❌ Failed to seed page_permissions cache:', error);
        return;
      }
      
      this.queryClient.setQueryData(['page_permissions', this.companyId], data || []);
      console.log(`✅ Seeded page_permissions cache with ${data?.length || 0} permissions`);
    } catch (error) {
      console.error('❌ Error seeding page_permissions cache:', error);
    }
  }

  private async seedTableGroupsCache() {
    if (!this.queryClient || !this.companyId) return;
    
    try {
      console.log('🌱 [CRITICAL] Seeding table_groups cache for company:', this.companyId);
      
      const { data, error } = await supabase
        .rpc('get_table_groups_with_tables', { p_company_id: this.companyId });
      
      if (error) {
        console.error('❌ [CRITICAL] Failed to seed table_groups cache:', error);
        throw error;  // Ensure this fails loudly
      }
      
      this.queryClient.setQueryData(['table_groups', this.companyId], data || []);
      console.log(`✅ [CRITICAL] Seeded table_groups cache with ${data?.length || 0} groups`);
      
      // Verify cache was set
      const cached = this.queryClient.getQueryData(['table_groups', this.companyId]);
      if (!cached || (Array.isArray(cached) && cached.length === 0)) {
        console.error('⚠️ [CRITICAL] Table groups cache verification FAILED!');
      } else {
        console.log('✅ [CRITICAL] Table groups cache verified');
      }
    } catch (error) {
      console.error('❌ [CRITICAL] Error seeding table_groups cache:', error);
      throw error;  // Propagate error to trigger retry
    }
  }

  private async seedDealsCache() {
    if (!this.queryClient || !this.companyId) return;
    
    try {
      const useEdgeFunctions = this.shouldUseEdgeFunctions();
      
      if (useEdgeFunctions) {
        const { data, error } = await supabase.functions.invoke('pin-deals-fetch', {
          body: { companyId: this.companyId, isDeviceBound: true }
        });

        if (error || !data?.success) {
          console.error('❌ Failed to seed deals via edge function:', error);
          return;
        }

        const deals = data.deals || [];
        this.queryClient.setQueryData(['deals', this.companyId], deals);
        console.log(`🌱 Seeded ${deals.length} deals (bound device mode)`);
      } else {
        const { data, error } = await supabase
          .from('deals')
          .select('*')
          .eq('company_id', this.companyId)
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true });
        
        if (error) {
          console.error('❌ Failed to seed deals cache:', error);
          return;
        }
        
        this.queryClient.setQueryData(['deals', this.companyId], data || []);
        console.log(`🌱 Seeded ${data?.length || 0} deals`);
      }
    } catch (error) {
      console.error('❌ Error seeding deals cache:', error);
    }
  }

  debugStatus(): any {
    return {
      isActive: this.isActive,
      companyId: this.companyId,
      subscriptionCount: this.subscriptions.length,
      reconnectAttempts: this.reconnectAttempts,
      offlineMode: this.offlineMode,
      lastOnlineSync: this.lastOnlineSync,
    };
  }

  getDebugInfo() {
    return {
      isActive: this.isActive,
      offlineMode: this.offlineMode,
      lastOnlineSync: this.lastOnlineSync,
    };
  }

  // Called when comprehensive prefetch completes (now optional)
  onPrefetchComplete(): void {
    console.log('🚀 Prefetch completed - DeviceDataManager already running');
  }
}

// Export singleton instance
export const DeviceDataManager = new DeviceDataManagerClass();