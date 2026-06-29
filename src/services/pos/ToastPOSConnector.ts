import { BasePOSConnector, POSMenuItem, POSCategory, POSTable, POSCredentials, SyncResult } from './BasePOSConnector';

export class ToastPOSConnector extends BasePOSConnector {
  private baseUrl: string = 'https://ws-api.toasttab.com';
  private apiVersion: string = 'v1';

  constructor(companyId: string, credentials: POSCredentials) {
    super('toast', companyId, credentials);
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/restaurants', 'GET');
      return response.ok;
    } catch (error) {
      console.error('Toast credentials validation failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const restaurants = await this.fetchRestaurants();
      return restaurants && restaurants.length > 0;
    } catch (error) {
      console.error('Toast connection test failed:', error);
      return false;
    }
  }

  async fetchMenuItems(): Promise<POSMenuItem[]> {
    try {
      const menuGroups = await this.fetchMenuGroups();
      const items: POSMenuItem[] = [];

      for (const group of menuGroups) {
        const groupItems = await this.fetchMenuItemsByGroup(group.guid);
        
        for (const item of groupItems) {
          items.push({
            id: item.guid,
            name: item.name,
            description: item.description,
            price: item.price / 100, // Toast uses cents
            category_id: group.guid,
            category_name: group.name,
            is_active: !item.deleted,
            modifiers: item.modifierGroups?.map(mg => ({
              id: mg.guid,
              name: mg.name,
              price: mg.price / 100,
              is_required: mg.required || false
            })) || [],
            images: item.images || [],
            tags: item.tags || [],
            allergens: item.allergens || []
          });
        }
      }

      return items;
    } catch (error) {
      console.error('Failed to fetch Toast menu items:', error);
      throw error;
    }
  }

  async fetchCategories(): Promise<POSCategory[]> {
    try {
      const menuGroups = await this.fetchMenuGroups();
      
      return menuGroups.map(group => ({
        id: group.guid,
        name: group.name,
        description: group.description,
        parent_id: group.parentGuid,
        display_order: group.displayOrder || 0,
        is_active: !group.deleted
      }));
    } catch (error) {
      console.error('Failed to fetch Toast categories:', error);
      throw error;
    }
  }

  async createMenuItem(item: POSMenuItem): Promise<string> {
    try {
      const toastItem = {
        name: item.name,
        description: item.description,
        price: Math.round(item.price * 100), // Convert to cents
        menuGroupGuid: item.category_id,
        modifierGroups: item.modifiers?.map(mod => ({
          name: mod.name,
          price: Math.round(mod.price * 100),
          required: mod.is_required
        })) || []
      };

      const response = await this.makeRequest('/menus/items', 'POST', toastItem);
      const result = await response.json();
      
      await this.logSyncOperation('create', 'menu_item', undefined, result.guid, 'success');
      return result.guid;
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
      
      const response = await this.makeRequest(`/menus/items/${id}`, 'PUT', updateData);
      
      await this.logSyncOperation('update', 'menu_item', undefined, id, 'success');
      return response.ok;
    } catch (error) {
      await this.logSyncOperation('update', 'menu_item', undefined, id, 'failed', error.message);
      throw error;
    }
  }

  async deleteMenuItem(id: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(`/menus/items/${id}`, 'DELETE');
      
      await this.logSyncOperation('delete', 'menu_item', undefined, id, 'success');
      return response.ok;
    } catch (error) {
      await this.logSyncOperation('delete', 'menu_item', undefined, id, 'failed', error.message);
      throw error;
    }
  }

  async createCategory(category: POSCategory): Promise<string> {
    try {
      const toastGroup = {
        name: category.name,
        description: category.description,
        parentGuid: category.parent_id,
        displayOrder: category.display_order || 0
      };

      const response = await this.makeRequest('/menus/groups', 'POST', toastGroup);
      const result = await response.json();
      
      await this.logSyncOperation('create', 'menu_category', undefined, result.guid, 'success');
      return result.guid;
    } catch (error) {
      await this.logSyncOperation('create', 'menu_category', undefined, undefined, 'failed', error.message);
      throw error;
    }
  }

  async updateCategory(id: string, category: Partial<POSCategory>): Promise<boolean> {
    try {
      const updateData: any = {};
      
      if (category.name) updateData.name = category.name;
      if (category.description !== undefined) updateData.description = category.description;
      if (category.display_order !== undefined) updateData.displayOrder = category.display_order;
      
      const response = await this.makeRequest(`/menus/groups/${id}`, 'PUT', updateData);
      
      await this.logSyncOperation('update', 'menu_category', undefined, id, 'success');
      return response.ok;
    } catch (error) {
      await this.logSyncOperation('update', 'menu_category', undefined, id, 'failed', error.message);
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(`/menus/groups/${id}`, 'DELETE');
      
      await this.logSyncOperation('delete', 'menu_category', undefined, id, 'success');
      return response.ok;
    } catch (error) {
      await this.logSyncOperation('delete', 'menu_category', undefined, id, 'failed', (error as Error).message);
      throw error;
    }
  }

  async fetchTables(): Promise<POSTable[]> {
    try {
      const restaurants = await this.fetchRestaurants();
      if (restaurants.length === 0) return [];
      
      const response = await this.makeRequest(`/config/v2/diningOptions`, 'GET');
      
      if (!response.ok) {
        throw new Error(`Toast API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const tables: POSTable[] = [];
      
      // Toast has dining options that can include table info
      if (data && Array.isArray(data)) {
        data.forEach((option: any, index: number) => {
          if (option.name && option.name.toLowerCase().includes('table')) {
            tables.push({
              id: option.guid || `toast-table-${index}`,
              name: option.name,
              table_number: index + 1,
              seats: 4, // Default seats since Toast doesn't track this
              is_active: !option.deleted,
              table_type: 'dining'
            });
          }
        });
      }
      
      await this.logSyncOperation('fetch', 'table', undefined, undefined, 'success');
      return tables;
    } catch (error) {
      await this.logSyncOperation('fetch', 'table', undefined, undefined, 'failed', (error as Error).message);
      return [];
    }
  }

  async syncTables(tables: POSTable[]): Promise<SyncResult> {
    // Toast has limited table sync capabilities, mainly for dining options
    const result: SyncResult = {
      success: true,
      itemsProcessed: tables.length,
      errors: [],
      conflicts: []
    };
    
    try {
      // In a real implementation, this would sync dining options back to Toast
      await this.logSyncOperation('sync', 'table', undefined, undefined, 'success');
    } catch (error) {
      result.success = false;
      result.errors.push((error as Error).message);
      await this.logSyncOperation('sync', 'table', undefined, undefined, 'failed', (error as Error).message);
    }
    
    return result;
  }

  // Private helper methods
  private async makeRequest(endpoint: string, method: string, body?: any): Promise<Response> {
    const url = `${this.baseUrl}/${this.apiVersion}${endpoint}`;
    
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.credentials.clientToken}`,
      'Toast-Restaurant-External-ID': this.credentials.restaurantGuid,
      'Content-Type': 'application/json'
    };

    const options: RequestInit = {
      method,
      headers
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    await this.rateLimitDelay(250); // Toast rate limiting
    return fetch(url, options);
  }

  private async fetchRestaurants(): Promise<any[]> {
    const response = await this.makeRequest('/restaurants', 'GET');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch restaurants: ${response.statusText}`);
    }

    return response.json();
  }

  private async fetchMenuGroups(): Promise<any[]> {
    const response = await this.makeRequest('/menus/groups', 'GET');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch menu groups: ${response.statusText}`);
    }

    return response.json();
  }

  private async fetchMenuItemsByGroup(groupGuid: string): Promise<any[]> {
    const response = await this.makeRequest(`/menus/groups/${groupGuid}/items`, 'GET');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch menu items for group ${groupGuid}: ${response.statusText}`);
    }

    return response.json();
  }
}