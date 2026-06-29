import CryptoJS from 'crypto-js';

export interface PeerChallenge {
  type: 'CHALLENGE_REQUEST' | 'CHALLENGE_RESPONSE' | 'CHALLENGE_VERIFY';
  deviceId: string;
  nonce?: string;
  challenge?: string;
  response?: string;
}

export interface SecureMessage {
  encrypted: string;
  timestamp: number;
}

class SecureP2PChannelService {
  private sessionKeys = new Map<string, string>();
  private pendingHandshakes = new Map<string, { nonce: string; peerNonce?: string }>();

  // Generate a random nonce for challenge-response
  private generateNonce(): string {
    return CryptoJS.lib.WordArray.random(32).toString();
  }

  // Create HMAC challenge using network secret
  private createChallenge(networkSecret: string, data: string): string {
    return CryptoJS.HmacSHA256(data, networkSecret).toString();
  }

  // Initiate handshake with a peer
  initiateHandshake(deviceId: string, peerId: string): PeerChallenge {
    const nonce = this.generateNonce();
    this.pendingHandshakes.set(peerId, { nonce });

    return {
      type: 'CHALLENGE_REQUEST',
      deviceId,
      nonce
    };
  }

  // Respond to handshake challenge
  respondToChallenge(
    networkSecret: string,
    deviceId: string,
    peerChallenge: PeerChallenge
  ): PeerChallenge | null {
    if (peerChallenge.type !== 'CHALLENGE_REQUEST' || !peerChallenge.nonce) {
      return null;
    }

    const myNonce = this.generateNonce();
    const combinedNonces = peerChallenge.nonce + myNonce;
    const challenge = this.createChallenge(networkSecret, combinedNonces);

    return {
      type: 'CHALLENGE_RESPONSE',
      deviceId,
      nonce: myNonce,
      challenge
    };
  }

  // Verify challenge response and complete handshake
  verifyAndComplete(
    networkSecret: string,
    deviceId: string,
    peerId: string,
    response: PeerChallenge
  ): { success: boolean; message?: PeerChallenge } {
    if (response.type !== 'CHALLENGE_RESPONSE' || !response.nonce || !response.challenge) {
      return { success: false };
    }

    const handshake = this.pendingHandshakes.get(peerId);
    if (!handshake) {
      return { success: false };
    }

    // Verify their challenge
    const expectedChallenge = this.createChallenge(
      networkSecret,
      handshake.nonce + response.nonce
    );

    if (expectedChallenge !== response.challenge) {
      console.error('[SecureP2P] Challenge verification failed');
      return { success: false };
    }

    // Store peer nonce and create our response
    handshake.peerNonce = response.nonce;
    const myResponse = this.createChallenge(networkSecret, response.nonce + handshake.nonce);

    // Derive session key
    const sessionKey = this.createChallenge(networkSecret, handshake.nonce + response.nonce);
    this.sessionKeys.set(peerId, sessionKey);

    console.log('[SecureP2P] Handshake completed with peer:', peerId);

    return {
      success: true,
      message: {
        type: 'CHALLENGE_VERIFY',
        deviceId,
        response: myResponse
      }
    };
  }

  // Final verification for the responding peer
  finalizeHandshake(
    networkSecret: string,
    peerId: string,
    myNonce: string,
    peerNonce: string,
    verification: PeerChallenge
  ): boolean {
    if (verification.type !== 'CHALLENGE_VERIFY' || !verification.response) {
      return false;
    }

    const expectedResponse = this.createChallenge(networkSecret, myNonce + peerNonce);

    if (expectedResponse !== verification.response) {
      console.error('[SecureP2P] Verification failed');
      return false;
    }

    // Derive session key
    const sessionKey = this.createChallenge(networkSecret, peerNonce + myNonce);
    this.sessionKeys.set(peerId, sessionKey);

    console.log('[SecureP2P] Handshake finalized with peer:', peerId);
    return true;
  }

  // Encrypt message for a peer
  encrypt(peerId: string, message: object): SecureMessage | null {
    const sessionKey = this.sessionKeys.get(peerId);
    if (!sessionKey) {
      console.error('[SecureP2P] No session key for peer:', peerId);
      return null;
    }

    const json = JSON.stringify(message);
    const encrypted = CryptoJS.AES.encrypt(json, sessionKey).toString();

    return {
      encrypted,
      timestamp: Date.now()
    };
  }

  // Decrypt message from a peer
  decrypt(peerId: string, secureMessage: SecureMessage): object | null {
    const sessionKey = this.sessionKeys.get(peerId);
    if (!sessionKey) {
      console.error('[SecureP2P] No session key for peer:', peerId);
      return null;
    }

    try {
      const decrypted = CryptoJS.AES.decrypt(secureMessage.encrypted, sessionKey);
      const json = decrypted.toString(CryptoJS.enc.Utf8);
      return JSON.parse(json);
    } catch (error) {
      console.error('[SecureP2P] Decryption failed:', error);
      return null;
    }
  }

  // Remove session key for a peer
  endSession(peerId: string): void {
    this.sessionKeys.delete(peerId);
    this.pendingHandshakes.delete(peerId);
  }

  // Check if peer has an active session
  hasSession(peerId: string): boolean {
    return this.sessionKeys.has(peerId);
  }
}

export const SecureP2PChannel = new SecureP2PChannelService();
