/**
 * Sync Coordinator - Intelligent routing between sync methods
 * Priority: Supabase Realtime → P2P Sync → OfflineMutationQueue
 */

import { LocalPeerSync } from './LocalPeerSync';
import { OfflineMutationQueue } from './OfflineMutationQueue';
import { getBoundCompany } from '@/utils/deviceBinding';
import { LocalNetworkDetection } from './LocalNetworkDetection';

interface SyncStatus {
  method: 'realtime' | 'p2p' | 'queue' | 'offline';
  isOnline: boolean;
  hasP2P: boolean;
  peerCount: number;
  networkId: string | null;
}

class SyncCoordinatorService {
  private isInitialized = false;
  private currentMethod: 'realtime' | 'p2p' | 'queue' | 'offline' = 'offline';
  
  /**
   * Initialize sync coordinator
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('🎯 Initializing SyncCoordinator');
    
    const boundCompany = getBoundCompany();
    if (!boundCompany) {
      console.log('⏭️ Not a bound device, skipping P2P initialization');
      this.isInitialized = true;
      return;
    }
    
    // Detect network and start P2P if available
    const networkInfo = await LocalNetworkDetection.detectNetwork();
    if (networkInfo.networkId) {
      await LocalPeerSync.start();
      console.log('✅ P2P sync started');
    }
    
    // Update current method
    this.updateSyncMethod();
    
    // Setup network listeners
    window.addEventListener('online', () => this.handleNetworkChange());
    window.addEventListener('offline', () => this.handleNetworkChange());
    
    this.isInitialized = true;
  }
  
  /**
   * Handle network state change
   */
  private async handleNetworkChange(): Promise<void> {
    const wasOnline = this.currentMethod === 'realtime';
    const isOnline = navigator.onLine;
    
    if (!wasOnline && isOnline) {
      // Back online - switch to realtime
      console.log('🌐 Network restored, switching to realtime sync');
      this.currentMethod = 'realtime';
    } else if (wasOnline && !isOnline) {
      // Went offline - try P2P or fallback to queue
      console.log('📡 Network lost, switching to fallback sync');
      await this.updateSyncMethod();
    }
  }
  
  /**
   * Update current sync method based on network conditions
   */
  private async updateSyncMethod(): Promise<void> {
    const status = await this.getSyncStatus();
    
    if (status.isOnline) {
      this.currentMethod = 'realtime';
    } else if (status.hasP2P) {
      this.currentMethod = 'p2p';
    } else {
      this.currentMethod = 'queue';
    }
    
    console.log('🎯 Sync method:', this.currentMethod, status);
  }
  
  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const isOnline = navigator.onLine;
    const hasP2P = LocalPeerSync.isConnected();
    const peerCount = LocalPeerSync.getPeerCount();
    const networkInfo = await LocalNetworkDetection.detectNetwork();
    
    let method: 'realtime' | 'p2p' | 'queue' | 'offline';
    if (isOnline) {
      method = 'realtime';
    } else if (hasP2P) {
      method = 'p2p';
    } else {
      method = 'queue';
    }
    
    return {
      method,
      isOnline,
      hasP2P,
      peerCount,
      networkId: networkInfo.networkId
    };
  }
  
  /**
   * Get current sync method
   */
  getCurrentMethod(): 'realtime' | 'p2p' | 'queue' | 'offline' {
    return this.currentMethod;
  }
  
  /**
   * Check if using P2P sync
   */
  isUsingP2P(): boolean {
    return this.currentMethod === 'p2p';
  }
  
  /**
   * Check if using realtime sync
   */
  isUsingRealtime(): boolean {
    return this.currentMethod === 'realtime';
  }
}

export const SyncCoordinator = new SyncCoordinatorService();
