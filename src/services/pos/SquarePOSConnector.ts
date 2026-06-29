import { BasePOSConnector, POSMenuItem, POSCategory, POSTable, POSCredentials, SyncResult } from './BasePOSConnector';

interface SquareCredentials extends POSCredentials {
  accessToken: string;
  applicationId: string;
  locationId: string;
  environment: 'sandbox' | 'production';
}

export class SquarePOSConnector extends BasePOSConnector {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(companyId: string, credentials: SquareCredentials) {
    super('square', companyId, credentials);
    
    const creds = credentials as SquareCredentials;
    this.baseUrl = creds.environment === 'production' 
      ? 'https://connect.squareup.com' 
      : 'https://connect.squareupsandbox.com';
    
    this.headers = {
      'Authorization': `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2024-08-21'
    };
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/locations`, {
        headers: this.headers
      });
      return response.ok;
    } catch (error) {
      console.error('Square credential validation failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const creds = this.credentials as SquareCredentials;
      const response = await fetch(`${this.baseUrl}/v2/locations/${creds.locationId}`, {
        headers: this.headers
      });
      return response.ok;
    } catch (error) {
      console.error('Square connection test failed:', error);
      return false;
    }
  }

  async fetchMenuItems(): Promise<POSMenuItem[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/catalog/list?types=ITEM`, {
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Square API error: ${response.statusText}`);
      }

      const data = await response.json();
      const items: POSMenuItem[] = [];

      if (data.objects) {
        for (const obj of data.objects) {
          if (obj.type === 'ITEM' && obj.item_data) {
            const item = obj.item_data;
            items.push({
              id: obj.id,
              name: item.name || '',
              description: item.description || '',
              price: item.variations?.[0]?.item_variation_data?.price_money?.amount || 0,
              category_id: item.category_id,
              is_active: !obj.is_deleted,
              images: item.image_ids || [],
              tags: []
            });
          }
        }
      }

      await this.logSyncOperation('fetch', 'menu_item', undefined, undefined, 'success');
      return items;
    } catch (error) {
      await this.logSyncOperation('fetch', 'menu_item', undefined, undefined, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async fetchCategories(): Promise<POSCategory[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/catalog/list?types=CATEGORY`, {
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Square API error: ${response.statusText}`);
      }

      const data = await response.json();
      const categories: POSCategory[] = [];

      if (data.objects) {
        for (const obj of data.objects) {
          if (obj.type === 'CATEGORY' && obj.category_data) {
            const category = obj.category_data;
            categories.push({
              id: obj.id,
              name: category.name || '',
              description: '',
              is_active: !obj.is_deleted
            });
          }
        }
      }

      await this.logSyncOperation('fetch', 'menu_category', undefined, undefined, 'success');
      return categories;
    } catch (error) {
      await this.logSyncOperation('fetch', 'menu_category', undefined, undefined, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async createMenuItem(item: POSMenuItem): Promise<string> {
    try {
      const requestBody = {
        idempotency_key: `${this.companyId}-${Date.now()}`,
        object: {
          type: 'ITEM',
          id: `#${item.name.replace(/\s+/g, '_').toLowerCase()}`,
          item_data: {
            name: item.name,
            description: item.description,
            category_id: item.category_id,
            variations: [
              {
                type: 'ITEM_VARIATION',
                id: `#${item.name.replace(/\s+/g, '_').toLowerCase()}_variation`,
                item_variation_data: {
                  name: 'Regular',
                  pricing_type: 'FIXED_PRICING',
                  price_money: {
                    amount: Math.round(item.price * 100), // Convert to cents
                    currency: 'USD'
                  }
                }
              }
            ]
          }
        }
      };

      const response = await fetch(`${this.baseUrl}/v2/catalog/object`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Square API error: ${response.statusText}`);
      }

      const data = await response.json();
      const createdId = data.catalog_object?.id;

      await this.logSyncOperation('create', 'menu_item', item.id, createdId, 'success');
      return createdId;
    } catch (error) {
      await this.logSyncOperation('create', 'menu_item', item.id, undefined, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async updateMenuItem(id: string, item: Partial<POSMenuItem>): Promise<boolean> {
    try {
      // First fetch the current item
      const fetchResponse = await fetch(`${this.baseUrl}/v2/catalog/object/${id}`, {
        headers: this.headers
      });

      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch item for update: ${fetchResponse.statusText}`);
      }

      const currentData = await fetchResponse.json();
      const currentItem = currentData.object;

      // Update the item data
      const updatedItem = {
        ...currentItem,
        item_data: {
          ...currentItem.item_data,
          name: item.name || currentItem.item_data.name,
          description: item.description || currentItem.item_data.description,
          category_id: item.category_id || currentItem.item_data.category_id
        }
      };

      if (item.price !== undefined && currentItem.item_data.variations?.[0]) {
        updatedItem.item_data.variations[0].item_variation_data.price_money.amount = Math.round(item.price * 100);
      }

      const requestBody = {
        idempotency_key: `update-${id}-${Date.now()}`,
        object: updatedItem
      };

      const response = await fetch(`${this.baseUrl}/v2/catalog/object`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestBody)
      });

      const success = response.ok;
      await this.logSyncOperation('update', 'menu_item', item.id, id, success ? 'success' : 'failed');
      return success;
    } catch (error) {
      await this.logSyncOperation('update', 'menu_item', item.id, id, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  async deleteMenuItem(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/catalog/object`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          idempotency_key: `delete-${id}-${Date.now()}`,
          object: {
            type: 'ITEM',
            id: id,
            version: -1,
            is_deleted: true
          }
        })
      });

      const success = response.ok;
      await this.logSyncOperation('delete', 'menu_item', undefined, id, success ? 'success' : 'failed');
      return success;
    } catch (error) {
      await this.logSyncOperation('delete', 'menu_item', undefined, id, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  async createCategory(category: POSCategory): Promise<string> {
    try {
      const requestBody = {
        idempotency_key: `${this.companyId}-cat-${Date.now()}`,
        object: {
          type: 'CATEGORY',
          id: `#${category.name.replace(/\s+/g, '_').toLowerCase()}`,
          category_data: {
            name: category.name
          }
        }
      };

      const response = await fetch(`${this.baseUrl}/v2/catalog/object`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Square API error: ${response.statusText}`);
      }

      const data = await response.json();
      const createdId = data.catalog_object?.id;

      await this.logSyncOperation('create', 'menu_category', category.id, createdId, 'success');
      return createdId;
    } catch (error) {
      await this.logSyncOperation('create', 'menu_category', category.id, undefined, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async updateCategory(id: string, category: Partial<POSCategory>): Promise<boolean> {
    try {
      const fetchResponse = await fetch(`${this.baseUrl}/v2/catalog/object/${id}`, {
        headers: this.headers
      });

      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch category for update: ${fetchResponse.statusText}`);
      }

      const currentData = await fetchResponse.json();
      const currentCategory = currentData.object;

      const updatedCategory = {
        ...currentCategory,
        category_data: {
          ...currentCategory.category_data,
          name: category.name || currentCategory.category_data.name
        }
      };

      const response = await fetch(`${this.baseUrl}/v2/catalog/object`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          idempotency_key: `update-cat-${id}-${Date.now()}`,
          object: updatedCategory
        })
      });

      const success = response.ok;
      await this.logSyncOperation('update', 'menu_category', category.id, id, success ? 'success' : 'failed');
      return success;
    } catch (error) {
      await this.logSyncOperation('update', 'menu_category', category.id, id, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  async deleteCategory(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/catalog/object`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          idempotency_key: `delete-cat-${id}-${Date.now()}`,
          object: {
            type: 'CATEGORY',
            id: id,
            version: -1,
            is_deleted: true
          }
        })
      });

      const success = response.ok;
      await this.logSyncOperation('delete', 'menu_category', undefined, id, success ? 'success' : 'failed');
      return success;
    } catch (error) {
      await this.logSyncOperation('delete', 'menu_category', undefined, id, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  async fetchTables(): Promise<POSTable[]> {
    // Square doesn't have a native tables API, so we return empty array
    // This could be extended if Square adds table management features
    await this.logSyncOperation('fetch', 'table', undefined, undefined, 'success');
    return [];
  }

  async syncTables(tables: POSTable[]): Promise<SyncResult> {
    // Square doesn't support table sync, so we just log it
    const result: SyncResult = {
      success: true,
      itemsProcessed: 0,
      errors: ['Square POS does not support table synchronization'],
      conflicts: []
    };
    
    await this.logSyncOperation('sync', 'table', undefined, undefined, 'success');
    return result;
  }
}