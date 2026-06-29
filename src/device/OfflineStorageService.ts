import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface QueryCacheDB extends DBSchema {
  'query-cache': {
    key: string;
    value: {
      queryKey: string;
      data: any;
      timestamp: number;
      companyId: string;
    };
    indexes: {
      companyId: string;
      timestamp: number;
    };
  };
  'metadata': {
    key: string;
    value: {
      key: string;
      lastSync: number;
      companyId: string;
    };
  };
}

class OfflineStorageService {
  private db: IDBPDatabase<QueryCacheDB> | null = null;
  private readonly DB_NAME = 'restaurant-offline-cache';
  private readonly DB_VERSION = 1;
  private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private activeCompanyId: string | null = null; // FIX #1: Track active company

  async initialize(): Promise<void> {
    try {
      this.db = await openDB<QueryCacheDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Query cache store
          if (!db.objectStoreNames.contains('query-cache')) {
            const cacheStore = db.createObjectStore('query-cache', { keyPath: 'queryKey' });
            cacheStore.createIndex('companyId', 'companyId');
            cacheStore.createIndex('timestamp', 'timestamp');
          }
          
          // Metadata store
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'key' });
          }
        },
      });
      console.log('✅ OfflineStorage initialized');
    } catch (error) {
      console.error('❌ Failed to initialize OfflineStorage:', error);
    }
  }

  /**
   * FIX #1: Set active company and purge old data if company changed
   */
  async setActiveCompany(companyId: string): Promise<void> {
    if (this.activeCompanyId === companyId) {
      console.log('✅ Company unchanged, no purge needed');
      return;
    }

    console.log(`🔄 Company switch detected: ${this.activeCompanyId} → ${companyId}`);
    
    // Purge old company data
    if (this.activeCompanyId) {
      console.log(`🧹 Purging data for old company: ${this.activeCompanyId}`);
      await this.clearCompanyCache(this.activeCompanyId);
    }

    this.activeCompanyId = companyId;
    console.log(`✅ Active company set to: ${companyId}`);
  }

  async saveCache(queryKey: string[], data: any, companyId: string): Promise<void> {
    if (!this.db) return;
    
    // FIX #1: Guard against cross-company data
    if (this.activeCompanyId && companyId !== this.activeCompanyId) {
      console.warn(`⚠️ Blocked cross-company cache write: ${companyId} !== ${this.activeCompanyId}`);
      return;
    }
    
    try {
      await this.db.put('query-cache', {
        queryKey: queryKey.join('::'), // Convert array to string key
        data,
        timestamp: Date.now(),
        companyId,
      });
    } catch (error) {
      console.error('❌ Failed to save cache to IndexedDB:', error);
    }
  }

  async loadCache(queryKey: string[]): Promise<any> {
    if (!this.db) return null;
    
    try {
      const key = queryKey.join('::');
      const cached = await this.db.get('query-cache', key);
      
      if (!cached) return null;
      
      // FIX #1: Guard against loading cross-company data
      if (this.activeCompanyId && cached.companyId !== this.activeCompanyId) {
        console.warn(`⚠️ Cross-company data detected in cache - purging: ${cached.companyId}`);
        await this.db.delete('query-cache', key);
        return null;
      }
      
      // Check if cache is still valid (within 7 days)
      if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
        await this.db.delete('query-cache', key);
        return null;
      }
      
      return cached.data;
    } catch (error) {
      console.error('❌ Failed to load cache from IndexedDB:', error);
      return null;
    }
  }

  async loadAllForCompany(companyId: string): Promise<Map<string, any>> {
    if (!this.db) return new Map();
    
    try {
      const tx = this.db.transaction('query-cache', 'readonly');
      const index = tx.store.index('companyId');
      const allCached = await index.getAll(companyId);
      
      const cacheMap = new Map<string, any>();
      const now = Date.now();
      
      for (const cached of allCached) {
        // Skip expired caches
        if (now - cached.timestamp > this.CACHE_DURATION) continue;
        
        cacheMap.set(cached.queryKey, cached.data);
      }
      
      console.log(`📦 Loaded ${cacheMap.size} cached queries for company ${companyId}`);
      return cacheMap;
    } catch (error) {
      console.error('❌ Failed to load all caches:', error);
      return new Map();
    }
  }

  async clearCompanyCache(companyId: string): Promise<void> {
    if (!this.db) return;
    
    try {
      const tx = this.db.transaction('query-cache', 'readwrite');
      const index = tx.store.index('companyId');
      const keys = await index.getAllKeys(companyId);
      
      for (const key of keys) {
        await tx.store.delete(key as string);
      }
      
      await tx.done;
      console.log(`🧹 Cleared offline cache for company ${companyId}`);
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
    }
  }

  async cleanup(): Promise<void> {
    if (!this.db) return;
    
    try {
      const tx = this.db.transaction('query-cache', 'readwrite');
      const index = tx.store.index('timestamp');
      const cutoff = Date.now() - this.CACHE_DURATION;
      
      const cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff));
      let deletedCount = 0;
      
      if (cursor) {
        do {
          await cursor.delete();
          deletedCount++;
        } while (await cursor.continue());
      }
      
      await tx.done;
      console.log(`🧹 Cleaned up ${deletedCount} expired cache entries`);
    } catch (error) {
      console.error('❌ Failed to cleanup old caches:', error);
    }
  }

  async setLastSync(companyId: string, timestamp: number): Promise<void> {
    if (!this.db) return;
    
    try {
      await this.db.put('metadata', {
        key: `lastSync::${companyId}`,
        lastSync: timestamp,
        companyId,
      });
    } catch (error) {
      console.error('❌ Failed to save last sync time:', error);
    }
  }

  async getLastSync(companyId: string): Promise<number | null> {
    if (!this.db) return null;
    
    try {
      const meta = await this.db.get('metadata', `lastSync::${companyId}`);
      return meta?.lastSync || null;
    } catch (error) {
      console.error('❌ Failed to get last sync time:', error);
      return null;
    }
  }
}

export const OfflineStorage = new OfflineStorageService();
