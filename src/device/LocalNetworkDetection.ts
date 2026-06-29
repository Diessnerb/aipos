/**
 * Local Network Detection using WebRTC
 * Detects if devices are on the same local network for P2P sync
 */

export interface NetworkInfo {
  networkId: string | null;
  localIP: string | null;
  timestamp: number;
}

class LocalNetworkDetectionService {
  private cachedNetworkInfo: NetworkInfo | null = null;
  private detectionInProgress = false;
  
  /**
   * Check if an IP is a local network address
   */
  private isLocalIP(ip: string): boolean {
    // Check for private IPv4 ranges
    const octets = ip.split('.').map(n => parseInt(n, 10));
    
    if (octets.length !== 4) return false;
    
    // 10.0.0.0/8
    if (octets[0] === 10) return true;
    
    // 172.16.0.0/12
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    
    // 192.168.0.0/16
    if (octets[0] === 192 && octets[1] === 168) return true;
    
    return false;
  }
  
  /**
   * Extract subnet from IP address (assumes /24 subnet)
   */
  private getSubnet(ip: string): string {
    const octets = ip.split('.');
    if (octets.length !== 4) return ip;
    
    // /24 subnet - first 3 octets
    return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  }
  
  /**
   * Detect local network using WebRTC ICE candidates
   */
  async detectNetwork(): Promise<NetworkInfo> {
    // Return cached result if recent (5 minutes)
    if (this.cachedNetworkInfo && 
        Date.now() - this.cachedNetworkInfo.timestamp < 5 * 60 * 1000) {
      return this.cachedNetworkInfo;
    }
    
    // Prevent concurrent detection
    if (this.detectionInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.cachedNetworkInfo || { networkId: null, localIP: null, timestamp: Date.now() };
    }
    
    this.detectionInProgress = true;
    
    try {
      const networkInfo = await this.performDetection();
      this.cachedNetworkInfo = networkInfo;
      return networkInfo;
    } finally {
      this.detectionInProgress = false;
    }
  }
  
  private async performDetection(): Promise<NetworkInfo> {
    return new Promise((resolve) => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [] // No STUN/TURN needed for local network detection
        });
        
        // Create a dummy data channel to trigger ICE gathering
        pc.createDataChannel('');
        
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            pc.close();
            console.log('⚠️ Network detection timeout - no local IP found');
            resolve({ networkId: null, localIP: null, timestamp: Date.now() });
          }
        }, 5000);
        
        pc.onicecandidate = (event) => {
          if (resolved) return;
          
          if (!event.candidate) {
            // ICE gathering complete but no local IP found
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              pc.close();
              resolve({ networkId: null, localIP: null, timestamp: Date.now() });
            }
            return;
          }
          
          const candidate = event.candidate.candidate;
          // Extract IP from candidate string
          // Example: "candidate:123 1 udp 123456 192.168.1.100 12345 typ host"
          const match = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
          
          if (match && this.isLocalIP(match[1])) {
            const localIP = match[1];
            const subnet = this.getSubnet(localIP);
            
            resolved = true;
            clearTimeout(timeout);
            pc.close();
            
            console.log('🌐 Local network detected:', { localIP, subnet });
            
            resolve({
              networkId: subnet,
              localIP,
              timestamp: Date.now()
            });
          }
        };
        
        // Create and set local description to start ICE gathering
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        
      } catch (error) {
        console.error('❌ Network detection failed:', error);
        resolve({ networkId: null, localIP: null, timestamp: Date.now() });
      }
    });
  }
  
  /**
   * Check if two network IDs are on the same subnet
   */
  isSameNetwork(networkId1: string | null, networkId2: string | null): boolean {
    if (!networkId1 || !networkId2) return false;
    return networkId1 === networkId2;
  }
  
  /**
   * Clear cached network info (force re-detection)
   */
  clearCache(): void {
    this.cachedNetworkInfo = null;
  }
}

export const LocalNetworkDetection = new LocalNetworkDetectionService();
