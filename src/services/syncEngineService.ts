import { supabase } from '@/integrations/supabase/client';
import { BasePOSConnector, POSMenuItem, POSCategory, SyncResult } from './pos/BasePOSConnector';
import { SquarePOSConnector } from './pos/SquarePOSConnector';
import { ToastPOSConnector } from './pos/ToastPOSConnector';
import { CloverPOSConnector } from './pos/CloverPOSConnector';

export interface SyncConfig {
  companyId: string;
  posSystem: string;
  syncDirection: 'bidirectional' | 'to_pos' | 'from_pos';
  conflictResolution: 'ordergeniesolution_wins' | 'pos_wins' | 'manual';
  batchSize: number;
  retryAttempts: number;
  enableRealtime: boolean;
}

export interface SyncStatus {
  isRunning: boolean;
  currentOperation?: string;
  progress: number;
  itemsProcessed: number;
  totalItems: number;
  errors: string[];
  startedAt?: Date;
  estimatedCompletion?: Date;
}

export class SyncEngineService {
  private config: SyncConfig;
  private status: SyncStatus;
  private connector: BasePOSConnector | null = null;
  private abortController: AbortController | null = null;

  constructor(config: SyncConfig) {
    this.config = config;
    this.status = {
      isRunning: false,
      progress: 0,
      itemsProcessed: 0,
      totalItems: 0,
      errors: []
    };
  }

  async initializeConnector(): Promise<void> {
    try {
      // Fetch credentials from database
      const { data: credentials, error } = await supabase
        .from('pos_credentials')
        .select('encrypted_credentials')
        .eq('company_id', this.config.companyId)
        .eq('pos_system', this.config.posSystem)
        .eq('connection_status', 'connected')
        .single();

      if (error || !credentials) {
        throw new Error(`No valid credentials found for ${this.config.posSystem}`);
      }

      // Create appropriate connector
      const creds = credentials.encrypted_credentials as any;
      
      switch (this.config.posSystem) {
        case 'square':
          this.connector = new SquarePOSConnector(this.config.companyId, creds);
          break;
        case 'toast':
          this.connector = new ToastPOSConnector(this.config.companyId, creds);
          break;
        case 'clover':
          this.connector = new CloverPOSConnector(this.config.companyId, creds);
          break;
        default:
          throw new Error(`Unsupported POS system: ${this.config.posSystem}`);
      }

      // Test connection
      const isConnected = await this.connector.testConnection();
      if (!isConnected) {
        throw new Error(`Failed to connect to ${this.config.posSystem}`);
      }
    } catch (error) {
      throw new Error(`Failed to initialize connector: ${error.message}`);
    }
  }

  async startSync(): Promise<SyncResult> {
    if (this.status.isRunning) {
      throw new Error('Sync is already running');
    }

    this.status = {
      isRunning: true,
      progress: 0,
      itemsProcessed: 0,
      totalItems: 0,
      errors: [],
      startedAt: new Date()
    };

    this.abortController = new AbortController();

    try {
      if (!this.connector) {
        await this.initializeConnector();
      }

      const result: SyncResult = {
        success: false,
        itemsProcessed: 0,
        errors: [],
        conflicts: []
      };

      switch (this.config.syncDirection) {
        case 'from_pos':
          return await this.syncFromPOS();
        case 'to_pos':
          return await this.syncToPOS();
        case 'bidirectional':
          return await this.bidirectionalSync();
        default:
          throw new Error(`Invalid sync direction: ${this.config.syncDirection}`);
      }
    } catch (error) {
      this.status.errors.push(error.message);
      throw error;
    } finally {
      this.status.isRunning = false;
      this.abortController = null;
    }
  }

  async syncFromPOS(): Promise<SyncResult> {
    if (!this.connector) throw new Error('Connector not initialized');

    this.updateStatus('Fetching remote data...');
    
    const [remoteItems, remoteCategories] = await Promise.all([
      this.connector.fetchMenuItems(),
      this.connector.fetchCategories()
    ]);

    this.status.totalItems = remoteItems.length + remoteCategories.length;

    const result: SyncResult = {
      success: true,
      itemsProcessed: 0,
      errors: [],
      conflicts: []
    };

    // Sync categories first (items depend on them)
    await this.processCategoriesFromPOS(remoteCategories, result);
    
    // Then sync items
    await this.processItemsFromPOS(remoteItems, result);

    result.success = result.errors.length === 0;
    return result;
  }

  async syncToPOS(): Promise<SyncResult> {
    if (!this.connector) throw new Error('Connector not initialized');

    this.updateStatus('Fetching local data...');

    // Fetch local data
    const { data: localCategories } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('company_id', this.config.companyId)
      .eq('is_active', true);

    const { data: localItems } = await supabase
      .from('menu_items')
      .select('*')
      .eq('company_id', this.config.companyId);

    this.status.totalItems = (localCategories?.length || 0) + (localItems?.length || 0);

    const result: SyncResult = {
      success: true,
      itemsProcessed: 0,
      errors: [],
      conflicts: []
    };

    // Process in chunks to avoid overwhelming the POS system
    await this.processCategoriesToPOS(localCategories || [], result);
    await this.processItemsToPOS(localItems || [], result);

    result.success = result.errors.length === 0;
    return result;
  }

  async bidirectionalSync(): Promise<SyncResult> {
    // For now, implement as: sync from POS first, then sync changes to POS
    // In a full implementation, this would include conflict detection and resolution
    
    const fromPOSResult = await this.syncFromPOS();
    
    // Only sync to POS if there were no major errors
    if (fromPOSResult.success || fromPOSResult.errors.length < 5) {
      const toPOSResult = await this.syncToPOS();
      
      return {
        success: fromPOSResult.success && toPOSResult.success,
        itemsProcessed: fromPOSResult.itemsProcessed + toPOSResult.itemsProcessed,
        errors: [...fromPOSResult.errors, ...toPOSResult.errors],
        conflicts: [...fromPOSResult.conflicts, ...toPOSResult.conflicts]
      };
    }

    return fromPOSResult;
  }

  private async processCategoriesFromPOS(categories: POSCategory[], result: SyncResult): Promise<void> {
    this.updateStatus('Syncing categories...');

    for (const category of categories) {
      if (this.abortController?.signal.aborted) break;

      try {
        await this.processCategoryFromPOS(category, result);
        this.status.itemsProcessed++;
        this.updateProgress();
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        result.errors.push(`Category ${category.name}: ${error.message}`);
      }
    }
  }

  private async processCategoryFromPOS(category: POSCategory, result: SyncResult): Promise<void> {
    // Check if category exists
    const { data: existing } = await supabase
      .from('menu_categories')
      .select('id, external_pos_id, updated_at')
      .eq('company_id', this.config.companyId)
      .or(`external_pos_id.eq.${category.id},name.eq.${category.name}`)
      .single();

    if (existing) {
      // Handle conflict resolution
      if (this.config.conflictResolution === 'ordergeniesolution_wins') {
        // Keep local version, just update external_pos_id if needed
        if (!existing.external_pos_id) {
          await supabase
            .from('menu_categories')
            .update({ 
              external_pos_id: category.id,
              pos_sync_status: 'synced',
              last_pos_sync: new Date().toISOString()
            })
            .eq('id', existing.id);
        }
      } else if (this.config.conflictResolution === 'pos_wins') {
        // Update with remote data
        await supabase
          .from('menu_categories')
          .update({
            name: category.name,
            description: category.description,
            parent_id: category.parent_id,
            display_order: category.display_order,
            external_pos_id: category.id,
            pos_sync_status: 'synced',
            last_pos_sync: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Manual resolution required
        result.conflicts.push({
          entityId: existing.id,
          entityType: 'menu_category',
          conflictReason: 'Category exists with different data',
          localData: existing,
          remoteData: category
        });
      }
    } else {
      // Create new category
      await supabase
        .from('menu_categories')
        .insert({
          company_id: this.config.companyId,
          name: category.name,
          description: category.description,
          parent_id: category.parent_id,
          display_order: category.display_order,
          external_pos_id: category.id,
          pos_sync_status: 'synced',
          last_pos_sync: new Date().toISOString()
        });
    }
  }

  private async processItemsFromPOS(items: POSMenuItem[], result: SyncResult): Promise<void> {
    this.updateStatus('Syncing menu items...');

    // Process in chunks
    for (let i = 0; i < items.length; i += this.config.batchSize) {
      if (this.abortController?.signal.aborted) break;

      const chunk = items.slice(i, i + this.config.batchSize);
      
      await Promise.all(chunk.map(async (item) => {
        try {
          await this.processItemFromPOS(item, result);
          this.status.itemsProcessed++;
        } catch (error) {
          result.errors.push(`Item ${item.name}: ${error.message}`);
        }
      }));

      this.updateProgress();
      
      // Rate limiting between chunks
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  private async processItemFromPOS(item: POSMenuItem, result: SyncResult): Promise<void> {
    // Look up local category ID
    let categoryId: string | null = null;
    if (item.category_id) {
      const { data: category } = await supabase
        .from('menu_categories')
        .select('id')
        .eq('company_id', this.config.companyId)
        .eq('external_pos_id', item.category_id)
        .single();
      
      categoryId = category?.id || null;
    }

    // Check if item exists
    const { data: existing, error: existingError } = await supabase
      .from('menu_items')
      .select('id, external_pos_id, price, name')
      .eq('company_id', this.config.companyId)
      .or(`external_pos_id.eq.${item.id},name.eq.${item.name}`)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError;
    }

    if (existing) {
      // Handle conflicts
      if (this.config.conflictResolution === 'ordergeniesolution_wins') {
        // Keep local, just link external ID
        if (!existing.external_pos_id) {
          await supabase
            .from('menu_items')
            .update({
              external_pos_id: item.id,
              pos_sync_status: 'synced',
              last_pos_sync: new Date().toISOString()
            })
            .eq('id', existing.id);
        }
      } else if (this.config.conflictResolution === 'pos_wins') {
        await supabase
          .from('menu_items')
          .update({
            name: item.name,
            description: item.description,
            price: item.price,
            category_id: categoryId,
            external_pos_id: item.id,
            pos_sync_status: 'synced',
            last_pos_sync: new Date().toISOString(),
            tags: item.tags,
            allergens: item.allergens
          })
          .eq('id', existing.id);
      } else {
        result.conflicts.push({
          entityId: existing.id,
          entityType: 'menu_item',
          conflictReason: 'Item exists with different data',
          localData: existing,
          remoteData: item
        });
      }
    } else {
      // Create new item
      await supabase
        .from('menu_items')
        .insert({
          company_id: this.config.companyId,
          name: item.name,
          description: item.description,
          price: item.price,
          category_id: categoryId,
          external_pos_id: item.id,
          pos_sync_status: 'synced',
          last_pos_sync: new Date().toISOString(),
          tags: item.tags,
          allergens: item.allergens
        });
    }
  }

  private async processCategoriesToPOS(categories: any[], result: SyncResult): Promise<void> {
    if (!this.connector) return;

    this.updateStatus('Uploading categories to POS...');

    for (const category of categories) {
      if (this.abortController?.signal.aborted) break;

      try {
        if (!category.external_pos_id) {
          // Create in POS
          const externalId = await this.connector.createCategory({
            id: category.id,
            name: category.name,
            description: category.description,
            parent_id: category.parent_id,
            display_order: category.display_order,
            is_active: category.is_active
          });

          // Update local record
          await supabase
            .from('menu_categories')
            .update({
              external_pos_id: externalId,
              pos_sync_status: 'synced',
              last_pos_sync: new Date().toISOString()
            })
            .eq('id', category.id)
            .eq('company_id', this.config.companyId);
        } else {
          // Update in POS
          await this.connector.updateCategory(category.external_pos_id, {
            name: category.name,
            description: category.description,
            display_order: category.display_order,
            is_active: category.is_active
          });
        }

        this.status.itemsProcessed++;
        this.updateProgress();
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        result.errors.push(`Category ${category.name}: ${error.message}`);
      }
    }
  }

  private async processItemsToPOS(items: any[], result: SyncResult): Promise<void> {
    if (!this.connector) return;

    this.updateStatus('Uploading items to POS...');

    for (const item of items) {
      if (this.abortController?.signal.aborted) break;

      try {
        if (!item.external_pos_id) {
          // Create in POS
          const externalId = await this.connector.createMenuItem({
            id: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            category_id: item.category_id,
            is_active: true,
            modifiers: [],
            images: item.image_urls || [],
            tags: item.tags || [],
            allergens: item.allergens || []
          });

          // Update local record
          await supabase
            .from('menu_items')
            .update({
              external_pos_id: externalId,
              pos_sync_status: 'synced',
              last_pos_sync: new Date().toISOString()
            })
            .eq('id', item.id)
            .eq('company_id', this.config.companyId);
        } else {
          // Update in POS
          await this.connector.updateMenuItem(item.external_pos_id, {
            name: item.name,
            description: item.description,
            price: item.price,
            is_active: true
          });
        }

        this.status.itemsProcessed++;
        this.updateProgress();
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        result.errors.push(`Item ${item.name}: ${error.message}`);
      }
    }
  }

  private updateStatus(operation: string): void {
    this.status.currentOperation = operation;
  }

  private updateProgress(): void {
    if (this.status.totalItems > 0) {
      this.status.progress = (this.status.itemsProcessed / this.status.totalItems) * 100;
      
      // Estimate completion time
      if (this.status.startedAt && this.status.progress > 0) {
        const elapsed = Date.now() - this.status.startedAt.getTime();
        const totalEstimated = (elapsed / this.status.progress) * 100;
        const remaining = totalEstimated - elapsed;
        this.status.estimatedCompletion = new Date(Date.now() + remaining);
      }
    }
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.status.isRunning = false;
    }
  }

  async cleanup(): Promise<void> {
    this.abort();
    this.connector = null;
  }
}
