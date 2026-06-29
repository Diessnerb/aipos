/**
 * Local Peer-to-Peer Sync using WebRTC Data Channels
 * Enables real-time device-to-device sync on same local network
 */

import { getBoundCompany } from '@/utils/deviceBinding';
import { LocalNetworkDetection } from './LocalNetworkDetection';
import { OfflineStorage } from './OfflineStorageService';
import { SecureP2PChannel, type SecureMessage } from './SecureP2PChannel';
import { NetworkDeviceDiscovery } from './NetworkDeviceDiscovery';
import { Capacitor } from '@capacitor/core';

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  lastSeen: number;
}

interface P2PMutation {
  type: 'mutation';
  mutation: {
    table: string;
    operation: 'insert' | 'update' | 'delete';
    id?: string;
    data: any;
    timestamp: number;
  };
  deviceId: string;
  companyId: string;
  networkId: string;
}

type P2PMessageHandler = (mutation: P2PMutation) => void;

class LocalPeerSyncService {
  private peers = new Map<string, PeerConnection>();
  private myDeviceId: string;
  private isActive = false;
  private messageHandlers: P2PMessageHandler[] = [];
  private discoveryInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.myDeviceId = this.getOrCreateDeviceId();
  }
  
  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('p2p-device-id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('p2p-device-id', deviceId);
    }
    return deviceId;
  }
  
  /**
   * Start P2P sync system
   */
  async start(): Promise<void> {
    if (this.isActive) {
      console.log('📡 LocalPeerSync already active');
      return;
    }
    
    const boundCompany = getBoundCompany();
    if (!boundCompany) {
      console.log('⏭️ LocalPeerSync: Not a bound device, skipping P2P');
      return;
    }
    
    const networkInfo = await LocalNetworkDetection.detectNetwork();
    if (!networkInfo.networkId) {
      console.log('⏭️ LocalPeerSync: No local network detected, skipping P2P');
      return;
    }
    
    this.isActive = true;
    console.log('📡 Starting LocalPeerSync:', {
      deviceId: this.myDeviceId,
      networkId: networkInfo.networkId,
      companyId: boundCompany.company_id
    });
    
    // Start mDNS discovery on native platforms
    if (Capacitor.isNativePlatform()) {
      const networkSecret = localStorage.getItem('network_secret');
      if (networkSecret) {
        await NetworkDeviceDiscovery.startDiscovery(
          networkSecret,
          this.myDeviceId
        );
      }
    }
    
    // Start peer discovery
    this.startPeerDiscovery(boundCompany.company_id, networkInfo.networkId);
    
    // Cleanup stale peers every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanupStalePeers(), 30000);
  }
  
  /**
   * Stop P2P sync system
   */
  async stop(): Promise<void> {
    console.log('📡 Stopping LocalPeerSync');
    this.isActive = false;
    
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Stop mDNS discovery
    if (Capacitor.isNativePlatform()) {
      await NetworkDeviceDiscovery.stopDiscovery();
    }
    
    // Close all peer connections
    for (const [peerId, peer] of this.peers) {
      peer.connection.close();
      SecureP2PChannel.endSession(peerId);
      console.log(`🔌 Closed connection to peer ${peerId}`);
    }
    this.peers.clear();
  }
  
  /**
   * Discover and connect to peers via IndexedDB signaling
   */
  private async startPeerDiscovery(companyId: string, networkId: string): Promise<void> {
    // Broadcast presence every 10 seconds
    this.discoveryInterval = setInterval(async () => {
      await this.broadcastPresence(companyId, networkId);
      await this.discoverPeers(companyId, networkId);
    }, 10000);
    
    // Initial broadcast
    await this.broadcastPresence(companyId, networkId);
    await this.discoverPeers(companyId, networkId);
  }
  
  /**
   * Broadcast device presence via IndexedDB
   */
  private async broadcastPresence(companyId: string, networkId: string): Promise<void> {
    const presence = {
      deviceId: this.myDeviceId,
      companyId,
      networkId,
      timestamp: Date.now()
    };
    
    await OfflineStorage.saveCache(
      ['p2p-presence', this.myDeviceId],
      presence,
      companyId
    );
  }
  
  /**
   * Discover other devices via IndexedDB
   */
  private async discoverPeers(companyId: string, networkId: string): Promise<void> {
    try {
      const allPresences = await OfflineStorage.loadAllForCompany(companyId);
      
      for (const [key, presence] of allPresences) {
        if (!key.startsWith('p2p-presence::')) continue;
        
        const data = presence as any;
        
        // Skip self
        if (data.deviceId === this.myDeviceId) continue;
        
        // Skip different networks
        if (data.networkId !== networkId) continue;
        
        // Skip stale presence (older than 30 seconds)
        if (Date.now() - data.timestamp > 30000) continue;
        
        // Connect to peer if not already connected
        if (!this.peers.has(data.deviceId)) {
          console.log(`🔍 Discovered peer: ${data.deviceId}`);
          await this.connectToPeer(data.deviceId, companyId);
        }
      }
    } catch (error) {
      console.error('❌ Failed to discover peers:', error);
    }
  }
  
  /**
   * Connect to a peer device
   */
  private async connectToPeer(peerId: string, companyId: string): Promise<void> {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [] // No STUN/TURN needed for local network
      });
      
      // Create data channel
      const dataChannel = pc.createDataChannel('p2p-sync', {
        ordered: true
      });
      
      this.setupDataChannel(dataChannel, peerId);
      
      const peerConnection: PeerConnection = {
        peerId,
        connection: pc,
        dataChannel,
        lastSeen: Date.now()
      };
      
      this.peers.set(peerId, peerConnection);
      
      // Create and send offer via IndexedDB signaling
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      await OfflineStorage.saveCache(
        ['p2p-offer', peerId, this.myDeviceId],
        {
          from: this.myDeviceId,
          to: peerId,
          offer: pc.localDescription,
          timestamp: Date.now()
        },
        companyId
      );
      
      // Listen for answer
      this.listenForAnswer(peerId, pc, companyId);
      
      console.log(`🤝 Sent offer to peer ${peerId}`);
    } catch (error) {
      console.error(`❌ Failed to connect to peer ${peerId}:`, error);
    }
  }
  
  /**
   * Listen for answer from peer
   */
  private async listenForAnswer(
    peerId: string, 
    pc: RTCPeerConnection, 
    companyId: string
  ): Promise<void> {
    // Poll for answer every 2 seconds for up to 30 seconds
    let attempts = 0;
    const maxAttempts = 15;
    
    const checkForAnswer = async () => {
      if (attempts++ >= maxAttempts) {
        console.log(`⏱️ Answer timeout for peer ${peerId}`);
        return;
      }
      
      try {
        const answer = await OfflineStorage.loadCache([
          'p2p-answer',
          this.myDeviceId,
          peerId
        ]);
        
        if (answer && (answer as any).answer) {
          await pc.setRemoteDescription(new RTCSessionDescription((answer as any).answer));
          console.log(`✅ Received answer from peer ${peerId}`);
          
          // Clear answer from storage
          await OfflineStorage.saveCache(
            ['p2p-answer', this.myDeviceId, peerId],
            null,
            companyId
          );
          return;
        }
      } catch (error) {
        // Continue polling
      }
      
      setTimeout(checkForAnswer, 2000);
    };
    
    setTimeout(checkForAnswer, 2000);
  }
  
  /**
   * Setup data channel event handlers
   */
  private setupDataChannel(dataChannel: RTCDataChannel, peerId: string): void {
    dataChannel.onopen = () => {
      console.log(`✅ Data channel open with peer ${peerId}`);
    };
    
    dataChannel.onclose = () => {
      console.log(`🔌 Data channel closed with peer ${peerId}`);
      this.peers.delete(peerId);
    };
    
    dataChannel.onerror = (error) => {
      console.error(`❌ Data channel error with peer ${peerId}:`, error);
    };
    
    dataChannel.onmessage = (event) => {
      try {
        const secureMessage: SecureMessage = JSON.parse(event.data);
        
        // Decrypt message
        const message = SecureP2PChannel.decrypt(peerId, secureMessage) as P2PMutation | null;
        if (!message) {
          console.error(`❌ Failed to decrypt message from ${peerId}`);
          return;
        }
        
        // Update last seen
        const peer = this.peers.get(peerId);
        if (peer) {
          peer.lastSeen = Date.now();
        }
        
        // Validate message
        if (message.type === 'mutation') {
          console.log(`📨 Received mutation from peer ${peerId}:`, message.mutation);
          
          // Notify all handlers
          this.messageHandlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('❌ P2P message handler error:', error);
            }
          });
        }
      } catch (error) {
        console.error(`❌ Failed to process P2P message from ${peerId}:`, error);
      }
    };
  }
  
  /**
   * Broadcast mutation to all connected peers
   */
  async broadcast(mutation: P2PMutation): Promise<void> {
    if (!this.isActive) return;
    
    let sentCount = 0;
    
    for (const [peerId, peer] of this.peers) {
      if (peer.dataChannel?.readyState === 'open') {
        try {
          // Encrypt message before sending
          const secureMessage = SecureP2PChannel.encrypt(peerId, mutation);
          if (secureMessage) {
            peer.dataChannel.send(JSON.stringify(secureMessage));
            sentCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to send to peer ${peerId}:`, error);
        }
      }
    }
    
    if (sentCount > 0) {
      console.log(`📡 Broadcasted encrypted mutation to ${sentCount} peer(s)`);
    }
  }
  
  /**
   * Register message handler
   */
  onMessage(handler: P2PMessageHandler): () => void {
    this.messageHandlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }
  
  /**
   * Cleanup stale peers (no activity for 60 seconds)
   */
  private cleanupStalePeers(): void {
    const now = Date.now();
    const staleThreshold = 60000; // 60 seconds
    
    for (const [peerId, peer] of this.peers) {
      if (now - peer.lastSeen > staleThreshold) {
        console.log(`🧹 Removing stale peer ${peerId}`);
        peer.connection.close();
        this.peers.delete(peerId);
      }
    }
  }
  
  /**
   * Check if P2P sync is connected
   */
  isConnected(): boolean {
    if (!this.isActive) return false;
    
    for (const peer of this.peers.values()) {
      if (peer.dataChannel?.readyState === 'open') {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get connected peer count
   */
  getPeerCount(): number {
    let count = 0;
    for (const peer of this.peers.values()) {
      if (peer.dataChannel?.readyState === 'open') {
        count++;
      }
    }
    return count;
  }
}

export const LocalPeerSync = new LocalPeerSyncService();
