import { supabase } from '@/integrations/supabase/client';
import { offlineAwareInsert } from '@/utils/offlineAwareSupabase';

export interface POSMenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id?: string;
  category_name?: string;
  is_active: boolean;
  modifiers?: POSModifier[];
  images?: string[];
  tags?: string[];
  allergens?: string[];
}

export interface POSCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  display_order?: number;
  is_active: boolean;
}

export interface POSModifier {
  id: string;
  name: string;
  price: number;
  is_required: boolean;
}

export interface POSTable {
  id: string;
  name: string;
  table_number?: number;
  seats: number;
  location?: string;
  section?: string;
  is_active: boolean;
  table_type?: string;
}

export interface POSCredentials {
  [key: string]: any;
}

export interface SyncResult {
  success: boolean;
  itemsProcessed: number;
  errors: string[];
  conflicts: Array<{
    entityId: string;
    entityType: 'menu_item' | 'menu_category';
    conflictReason: string;
    localData: any;
    remoteData: any;
  }>;
}

export abstract class BasePOSConnector {
  protected posSystem: string;
  protected companyId: string;
  protected credentials: POSCredentials;

  constructor(posSystem: string, companyId: string, credentials: POSCredentials) {
    this.posSystem = posSystem;
    this.companyId = companyId;
    this.credentials = credentials;
  }

  // Abstract methods that must be implemented by each POS connector
  abstract validateCredentials(): Promise<boolean>;
  abstract testConnection(): Promise<boolean>;
  abstract fetchMenuItems(): Promise<POSMenuItem[]>;
  abstract fetchCategories(): Promise<POSCategory[]>;
  abstract createMenuItem(item: POSMenuItem): Promise<string>;
  abstract updateMenuItem(id: string, item: Partial<POSMenuItem>): Promise<boolean>;
  abstract deleteMenuItem(id: string): Promise<boolean>;
  abstract createCategory(category: POSCategory): Promise<string>;
  abstract updateCategory(id: string, category: Partial<POSCategory>): Promise<boolean>;
  abstract deleteCategory(id: string): Promise<boolean>;
  
  // Table management methods (optional for POS systems that support it)
  abstract fetchTables(): Promise<POSTable[]>;
  abstract syncTables(tables: POSTable[]): Promise<SyncResult>;

  // Common sync operations
  async logSyncOperation(
    operation: string,
    entityType: 'menu_item' | 'menu_category' | 'table' | 'full_menu',
    entityId?: string,
    externalEntityId?: string,
    status: 'success' | 'failed' | 'conflict' = 'success',
    errorDetails?: string,
    dataBefore?: any,
    dataAfter?: any
  ) {
    try {
      const logTable = entityType === 'table' ? 'pos_table_sync_logs' : 'pos_sync_logs';
      
      if (entityType === 'table') {
        await offlineAwareInsert('pos_table_sync_logs', {
          company_id: this.companyId,
          pos_system: this.posSystem,
          operation,
          table_id: entityId,
          external_table_id: externalEntityId,
          status,
          data_before: dataBefore,
          data_after: dataAfter,
          error_details: errorDetails,
          processed_at: new Date().toISOString()
        });
      } else {
        await offlineAwareInsert('pos_sync_logs', {
          company_id: this.companyId,
          pos_system: this.posSystem,
          sync_direction: 'bidirectional',
          entity_type: entityType,
          entity_id: entityId,
          external_entity_id: externalEntityId,
          operation,
          status,
          data_before: dataBefore,
          data_after: dataAfter,
          error_details: errorDetails,
          processed_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to log sync operation:', error);
    }
  }

  async updateSyncStatus(
    entityId: string,
    entityType: 'menu_item' | 'menu_category' | 'table',
    status: 'syncing' | 'synced' | 'conflict' | 'error',
    externalId?: string,
    conflicts?: any
  ) {
    try {
      const table = entityType === 'menu_item' ? 'menu_items' : 
                   entityType === 'menu_category' ? 'menu_categories' : 'tables';
      const updateData: any = {
        pos_sync_status: status,
        last_pos_sync: new Date().toISOString()
      };

      if (externalId) {
        updateData.external_pos_id = externalId;
      }

      if (conflicts) {
        updateData.sync_conflicts = conflicts;
      }

      await supabase
        .from(table)
        .update(updateData)
        .eq('id', entityId)
        .eq('company_id', this.companyId);
    } catch (error) {
      console.error('Failed to update sync status:', error);
    }
  }

  // Rate limiting helper
  protected async rateLimitDelay(delayMs: number = 200) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  // Chunked processing helper
  protected async processInChunks<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    chunkSize: number = 10
  ) {
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      await Promise.all(chunk.map(processor));
      await this.rateLimitDelay();
    }
  }
}