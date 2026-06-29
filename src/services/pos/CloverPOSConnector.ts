import { BasePOSConnector, POSMenuItem, POSCategory, POSTable, POSCredentials, SyncResult } from './BasePOSConnector';

export class CloverPOSConnector extends BasePOSConnector {
  private baseUrl: string = 'https://api.clover.com';
  private sandboxUrl: string = 'https://sandbox.dev.clover.com';
  private apiVersion: string = 'v3';

  constructor(companyId: string, credentials: POSCredentials) {
    super('clover', companyId, credentials);
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/merchants/current', 'GET');
      return response.ok;
    } catch (error) {
      console.error('Clover credentials validation failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const merchant = await this.fetchMerchant();
      return merchant && merchant.id;
    } catch (error) {
      console.error('Clover connection test failed:', error);
      return false;
    }
  }

  async fetchMenuItems(): Promise<POSMenuItem[]> {
    try {
      const categories = await this.fetchInventoryCategories();
      const items: POSMenuItem[] = [];

      // Fetch all items in batches
      const allItems = await this.fetchAllInventoryItems();
      
      for (const item of allItems) {
        const category = categories.find(cat => cat.id === item.category?.id);
        
        items.push({
          id: item.id,
          name: item.name,
          description: item.description || '',
          price: item.price ? item.price / 100 : 0, // Clover uses cents
          category_id: item.category?.id,
          category_name: category?.name,
          is_active: !item.hidden,
          modifiers: item.modifierGroups?.elements?.map(mg => ({
            id: mg.id,
            name: mg.name,
            price: mg.price ? mg.price / 100 : 0,
            is_required: mg.minRequired > 0
          })) || [],
          images: item.images?.elements?.map(img => img.url) || [],
          tags: item.tags?.elements?.map(tag => tag.name) || [],
          allergens: [] // Clover doesn't have native allergen support
        });
      }

      return items;
    } catch (error) {
      console.error('Failed to fetch Clover menu items:', error);
      throw error;
    }
  }

  async fetchCategories(): Promise<POSCategory[]> {
    try {
      const categories = await this.fetchInventoryCategories();
      
      return categories.map(category => ({
        id: category.id,
        name: category.name,
        description: '', // Clover categories don't have descriptions
        parent_id: undefined, // Clover doesn't support nested categories
        display_order: category.sortOrder || 0,
        is_active: true
      }));
    } catch (error) {
      console.error('Failed to fetch Clover categories:', error);
      throw error;
    }
  }

  async createMenuItem(item: POSMenuItem): Promise<string> {
    try {
      const cloverItem = {
        name: item.name,
        description: item.description,
        price: Math.round(item.price * 100), // Convert to cents
        category: item.category_id ? { id: item.category_id } : undefined,
        hidden: !item.is_active
      };

      const response = await this.makeRequest('/merchants/current/items', 'POST', cloverItem);
      const result = await response.json();
      
      await this.logSyncOperation('create', 'menu_item', undefined, result.id, 'success');
      return result.id;
    } catch (error) {
      await this.logSyncOperation('create', 'menu_item', undefined, undefined, 'failed', error.message);
      throw error;
    }
  }

  async updateMenuItem(id: string, item: Partial<POSMenuItem>): Promise<boolean> {
    try {
      const updateData: any = {};
      
      if (item.name) updateData.name = item.name;
      if (item.description !== undefined) updateData.description = item.description;
      if (item.price !== undefined) updateData.price = Math.round(item.price * 100);
      if (item.is_active !== undefined) updateData.hidden = !item.is_active;
      
      const response = await this.makeRequest(`/merchants/current/items/${id}`, 'POST', updateData);
      
      await this.logSyncOperation('update', 'menu_item', undefined, id, 'success');
      return response.ok;
    } catch (error) {
      await this.logSyncOperation('update', 'menu_item', undefined, id, 'failed', error.message);
      throw error;
    }
  }

  async deleteMenuItem(id: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(`/merchants/current/items/${id}`, 'DELETE');
      
      await this.logSyncOperation('delete', 'menu_item', undefined, id, 'success');
      return response.ok;
    } catch (error) {
      await this.logSyncOperation('delete', 'menu_item', undefined, id, 'failed', error.message);
      throw error;
    }
  }

  async createCategory(category: POSCategory): Promise<string> {
    try {
      const cloverCategory = {
        name: category.name,
        sortOrder: category.display_order || 0
      };

      const response = await this.makeRequest('/merchants/current/categories', 'POST', cloverCategory);
      const result = await response.json();
      
      await this.logSyncOperation('create', 'menu_category', undefined, result.id, 'success');
      return result.id;
    } catch (error) {
      await this.logSyncOperation('create', 'menu_category', undefined, undefined, 'failed', error.message);
      throw error;
    }
  }

  async updateCategory(id: string, category: Partial<POSCategory>): Promise<boolean> {
    try {
      const updateData: any = {};
      
      if (category.name) updateData.name = category.name;
      if (category.display_order !== undefined) updateData.sortOrder = category.display_order;
      
      const response = await this.makeRequest(`/merchants/current/categories/${id}`, 'POST', updateData);
      
      await this.logSyncOperation('update', 'menu_category', undefined, id, 'success');
      return response.ok;
    } catch (error) {
      await this.logSyncOperation('update', 'menu_category', undefined, id, 'failed', error.message);
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(`/merchants/current/categories/${id}`, 'DELETE');
      
      await this.logSyncOperation('delete', 'menu_category', undefined, id, 'success');
      return response.ok;
    } catch (error) {
      await this.logSyncOperation('delete', 'menu_category', undefined, id, 'failed', error.message);
      throw error;
    }
  }

  // Private helper methods
  private async makeRequest(endpoint: string, method: string, body?: any): Promise<Response> {
    const baseUrl = this.credentials.sandbox ? this.sandboxUrl : this.baseUrl;
    const url = `${baseUrl}/${this.apiVersion}${endpoint}`;
    
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.credentials.accessToken}`,
      'Content-Type': 'application/json'
    };

    const options: RequestInit = {
      method,
      headers
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    await this.rateLimitDelay(100); // Clover rate limiting
    return fetch(url, options);
  }

  private async fetchMerchant(): Promise<any> {
    const response = await this.makeRequest('/merchants/current', 'GET');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch merchant: ${response.statusText}`);
    }

    return response.json();
  }

  private async fetchInventoryCategories(): Promise<any[]> {
    const response = await this.makeRequest('/merchants/current/categories', 'GET');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.statusText}`);
    }

    const result = await response.json();
    return result.elements || [];
  }

  private async fetchAllInventoryItems(): Promise<any[]> {
    let allItems: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeRequest(
        `/merchants/current/items?limit=${limit}&offset=${offset}&expand=categories,modifierGroups,tags,images`, 
        'GET'
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch items: ${response.statusText}`);
      }

      const result = await response.json();
      const items = result.elements || [];
      
      allItems = allItems.concat(items);
      hasMore = items.length === limit;
      offset += limit;
      
      // Rate limit protection
      if (hasMore) {
        await this.rateLimitDelay(200);
      }
    }

    return allItems;
  }

  async fetchTables(): Promise<POSTable[]> {
    // Clover doesn't have a native tables API in their current version
    // This could be extended if Clover adds table management features
    await this.logSyncOperation('fetch', 'table', undefined, undefined, 'success');
    return [];
  }

  async syncTables(tables: POSTable[]): Promise<SyncResult> {
    // Clover doesn't support table sync currently
    const result: SyncResult = {
      success: true,
      itemsProcessed: 0,
      errors: ['Clover POS does not currently support table synchronization'],
      conflicts: []
    };
    
    await this.logSyncOperation('sync', 'table', undefined, undefined, 'success');
    return result;
  }
}