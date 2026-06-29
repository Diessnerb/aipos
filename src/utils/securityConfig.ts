// Security configuration and utilities
import { SecureStorage } from './secureStorage';

export interface SecurityConfig {
  sessionTimeout: number; // in minutes
  maxLoginAttempts: number;
  lockoutDuration: number; // in minutes
  requireMFA: boolean;
  auditLogging: boolean;
}

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  sessionTimeout: 480, // 8 hours
  maxLoginAttempts: 5,
  lockoutDuration: 15, // 15 minutes
  requireMFA: false,
  auditLogging: true
};

export class SecurityManager {
  private static config: SecurityConfig = DEFAULT_SECURITY_CONFIG;

  static updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    SecureStorage.setItem('security_config', this.config);
  }

  static getConfig(): SecurityConfig {
    const stored = SecureStorage.getItem('security_config');
    return stored || this.config;
  }

  static isSessionExpired(lastActivity: number): boolean {
    const now = Date.now();
    const config = this.getConfig();
    return (now - lastActivity) > (config.sessionTimeout * 60 * 1000);
  }

  static shouldLockAccount(attempts: number): boolean {
    const config = this.getConfig();
    return attempts >= config.maxLoginAttempts;
  }

  static getLockoutTime(): number {
    const config = this.getConfig();
    return config.lockoutDuration * 60 * 1000; // Convert to milliseconds
  }

  static logSecurityEvent(event: string, details?: any): void {
    const config = this.getConfig();
    if (!config.auditLogging) return;

    // Only log critical security events to console for debugging
    // Remove client-side storage of security logs for security
    console.warn('🔒 Security Event:', {
      timestamp: new Date().toISOString(),
      event,
      details: typeof details === 'object' ? JSON.stringify(details) : details,
      userAgent: navigator.userAgent.substring(0, 50), // Limit data exposure
      url: window.location.pathname // Don't log full URL with sensitive params
    });
    
    // TODO: In production, send security events to server-side logging service
    // This would typically be done via an edge function or secure API endpoint
  }
}

// Security warnings for users
export const SECURITY_RECOMMENDATIONS = {
  AUTH_SETTINGS: {
    title: "Authentication Settings Required",
    description: "For enhanced security, please configure the following in your Supabase dashboard:",
    actions: [
      {
        setting: "Leaked Password Protection",
        description: "Enable protection against compromised passwords",
        url: "https://supabase.com/dashboard/project/blsrpowvuxcvhqkeykyi/auth/providers"
      },
      {
        setting: "Multi-Factor Authentication",
        description: "Enable additional MFA options (TOTP, Phone)",
        url: "https://supabase.com/dashboard/project/blsrpowvuxcvhqkeykyi/auth/providers"
      }
    ]
  },
  DATABASE_SECURITY: {
    title: "Database Security Enhanced",
    description: "The following security improvements have been implemented:",
    features: [
      "Row-Level Security policies strengthened",
      "Rate limiting for PIN authentication",
      "Secure credential storage (encrypted)",
      "Audit logging for sensitive operations",
      "Function search path protection"
    ]
  }
};

// Auto-cleanup old security logs on app start
if (typeof window !== 'undefined') {
  SecurityManager.logSecurityEvent('app_started', {
    timestamp: Date.now(),
    userAgent: navigator.userAgent
  });
}
