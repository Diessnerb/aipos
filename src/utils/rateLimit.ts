// Client-side rate limiting utilities for security
interface RateLimitAttempt {
  timestamp: number;
  success: boolean;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  lockoutMs: 15 * 60 * 1000  // 15 minutes lockout
};

export class ClientRateLimit {
  private static getAttempts(key: string): RateLimitAttempt[] {
    try {
      const stored = localStorage.getItem(`rate_limit_${key}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private static setAttempts(key: string, attempts: RateLimitAttempt[]): void {
    try {
      localStorage.setItem(`rate_limit_${key}`, JSON.stringify(attempts));
    } catch {
      // Silently fail if storage is unavailable
    }
  }

  static isLocked(key: string, config: Partial<RateLimitConfig> = {}): boolean {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    const attempts = this.getAttempts(key);
    const now = Date.now();
    
    // Clean old attempts
    const recentAttempts = attempts.filter(
      attempt => now - attempt.timestamp < fullConfig.windowMs
    );
    
    // Count failed attempts
    const failedAttempts = recentAttempts.filter(attempt => !attempt.success);
    
    return failedAttempts.length >= fullConfig.maxAttempts;
  }

  static recordAttempt(key: string, success: boolean, config: Partial<RateLimitConfig> = {}): void {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    const attempts = this.getAttempts(key);
    const now = Date.now();
    
    // Add new attempt
    attempts.push({ timestamp: now, success });
    
    // Clean old attempts
    const recentAttempts = attempts.filter(
      attempt => now - attempt.timestamp < fullConfig.windowMs
    );
    
    // Store cleaned attempts
    this.setAttempts(key, recentAttempts);
  }

  static clearAttempts(key: string): void {
    try {
      localStorage.removeItem(`rate_limit_${key}`);
    } catch {
      // Silently fail if storage is unavailable
    }
  }

  static getTimeUntilUnlock(key: string, config: Partial<RateLimitConfig> = {}): number {
    if (!this.isLocked(key, config)) return 0;
    
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    const attempts = this.getAttempts(key);
    const now = Date.now();
    
    // Find the earliest failed attempt that would cause lockout
    const failedAttempts = attempts
      .filter(attempt => !attempt.success && now - attempt.timestamp < fullConfig.windowMs)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    if (failedAttempts.length >= fullConfig.maxAttempts) {
      const oldestRelevantAttempt = failedAttempts[0];
      const unlockTime = oldestRelevantAttempt.timestamp + fullConfig.lockoutMs;
      return Math.max(0, unlockTime - now);
    }
    
    return 0;
  }
}