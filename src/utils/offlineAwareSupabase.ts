import { supabase } from '@/integrations/supabase/client';
import { OfflineMutationQueue } from '@/device/OfflineMutationQueue';
import { getBoundCompany } from '@/utils/deviceBinding';
import { LocalPeerSync } from '@/device/LocalPeerSync';
import { LocalNetworkDetection } from '@/device/LocalNetworkDetection';

/**
 * Wrapper for Supabase INSERT that uses edge functions for bound devices
 */
export async function offlineAwareInsert(table: string, data: any) {
  const isOnline = navigator.onLine;
  const boundCompany = getBoundCompany();
  
  // Queue for offline sync
  if (!isOnline && boundCompany) {
    await OfflineMutationQueue.queueMutation(
      table,
      'insert',
      data,
      boundCompany.company_id
    );
    
    return {
      data: { ...data, id: crypto.randomUUID() },
      error: null,
    };
  }
  
  // For bound devices (online), use edge function to bypass RLS
  if (boundCompany) {
    console.log(`🔧 offlineAwareInsert: Using edge function for ${table}`);
    const { data: result, error } = await supabase.functions.invoke('pin-mutation', {
      body: {
        companyId: boundCompany.company_id,
        table,
        operation: 'insert',
        data,
        isDeviceBound: true
      }
    });
    
    if (error) {
      console.error(`❌ Edge function mutation failed for ${table}:`, error);
      return { data: null, error };
    }
    
    if (!result?.success) {
      return { data: null, error: new Error(result?.error || 'Mutation failed') };
    }
    
    return { data: result.data, error: null };
  }
  
  // Authenticated web users - normal Supabase call
  return await (supabase.from as any)(table).insert(data).select().single();
}

/**
 * Wrapper for Supabase UPDATE that uses edge functions for bound devices
 */
export async function offlineAwareUpdate(table: string, id: string, data: any) {
  const isOnline = navigator.onLine;
  const boundCompany = getBoundCompany();
  
  // Queue for offline sync + broadcast to P2P peers
  if (!isOnline && boundCompany) {
    await OfflineMutationQueue.queueMutation(
      table,
      'update',
      { ...data, id },
      boundCompany.company_id
    );
    
    // Broadcast to P2P peers if connected
    if (LocalPeerSync.isConnected()) {
      const networkInfo = await LocalNetworkDetection.detectNetwork();
      await LocalPeerSync.broadcast({
        type: 'mutation',
        mutation: {
          table,
          operation: 'update',
          id,
          data: { ...data, id },
          timestamp: Date.now()
        },
        deviceId: localStorage.getItem('p2p-device-id') || 'unknown',
        companyId: boundCompany.company_id,
        networkId: networkInfo.networkId || 'unknown'
      });
    }
    
    return { data: { ...data, id }, error: null };
  }
  
  // For bound devices (online), use edge function to bypass RLS
  if (boundCompany) {
    console.log(`🔧 offlineAwareUpdate: Using edge function for ${table}`);
    const { data: result, error } = await supabase.functions.invoke('pin-mutation', {
      body: {
        companyId: boundCompany.company_id,
        table,
        operation: 'update',
        id,
        data,
        isDeviceBound: true
      }
    });
    
    if (error) {
      console.error(`❌ Edge function mutation failed for ${table}:`, error);
      return { data: null, error };
    }
    
    if (!result?.success) {
      return { data: null, error: new Error(result?.error || 'Mutation failed') };
    }
    
    return { data: result.data, error: null };
  }
  
  // Authenticated web users - normal Supabase call
  return await (supabase.from as any)(table).update(data).eq('id', id).select().single();
}

/**
 * Wrapper for Supabase FETCH that uses edge functions for bound devices
 */
export async function offlineAwareFetch(
  table: string, 
  filters: { column: string; value: any }[]
) {
  const boundCompany = getBoundCompany();
  
  // For bound devices (online or offline), use edge function to bypass RLS
  if (boundCompany) {
    console.log(`🔧 offlineAwareFetch: Using edge function for ${table}`);
    const { data: result, error } = await supabase.functions.invoke('pin-mutation', {
      body: {
        companyId: boundCompany.company_id,
        table,
        operation: 'fetch',
        data: { filters },
        isDeviceBound: true
      }
    });
    
    if (error) {
      console.error(`❌ Edge function fetch failed for ${table}:`, error);
      return { data: null, error };
    }
    
    if (!result?.success) {
      return { data: null, error: new Error(result?.error || 'Fetch failed') };
    }
    
    return { data: result.data, error: null };
  }
  
  // Authenticated web users - normal Supabase call with filters
  let query = (supabase.from as any)(table).select('*');
  filters.forEach(f => {
    query = query.eq(f.column, f.value);
  });
  return await query;
}

/**
 * Wrapper for Supabase DELETE that uses edge functions for bound devices
 */
export async function offlineAwareDelete(table: string, id: string) {
  const isOnline = navigator.onLine;
  const boundCompany = getBoundCompany();
  
  // Queue for offline sync
  if (!isOnline && boundCompany) {
    await OfflineMutationQueue.queueMutation(
      table,
      'delete',
      { id },
      boundCompany.company_id
    );
    
    return { data: null, error: null };
  }
  
  // For bound devices (online), use edge function to bypass RLS
  if (boundCompany) {
    console.log(`🔧 offlineAwareDelete: Using edge function for ${table}`);
    const { data: result, error } = await supabase.functions.invoke('pin-mutation', {
      body: {
        companyId: boundCompany.company_id,
        table,
        operation: 'delete',
        id,
        isDeviceBound: true
      }
    });
    
    if (error) {
      console.error(`❌ Edge function mutation failed for ${table}:`, error);
      return { data: null, error };
    }
    
    if (!result?.success) {
      return { data: null, error: new Error(result?.error || 'Mutation failed') };
    }
    
    return { data: null, error: null };
  }
  
  // Authenticated web users - normal Supabase call
  return await (supabase.from as any)(table).delete().eq('id', id);
}
