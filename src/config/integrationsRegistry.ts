import { 
  Instagram, 
  Facebook, 
  Mail, 
  MessageSquare, 
  BarChart3, 
  Calculator, 
  FileText, 
  Users, 
  Code, 
  Phone,
  Calendar,
  CreditCard,
  Briefcase,
  Shield,
  Slack,
  Monitor
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  logo?: string;
  category: string;
  isActive: boolean;
  comingSoon?: boolean;
  requiresMarketing?: boolean;
  connectionType: 'oauth' | 'api_key' | 'webhook' | 'manual';
  brandColor?: string;
  brandTextColor?: string;
  brandGradient?: string;
  logoBg?: string;
  fields?: {
    name: string;
    label: string;
    type: 'text' | 'password' | 'email' | 'url';
    placeholder?: string;
    required?: boolean;
  }[];
}

export const INTEGRATION_CATEGORIES = {
  POS: 'POS Systems',
  SOCIAL: 'Social',
  MARKETING: 'Marketing & Email',
  ANALYTICS: 'Analytics',
  COMMUNICATION: 'Communication',
  ACCOUNTING: 'Accounting',
  LEGAL_HR: 'Legal & HR',
  DEVELOPER: 'Developer'
} as const;

export const integrationsRegistry: Integration[] = [
  // Social - Active
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Connect your Instagram Business account for content posting and DM management',
    icon: Instagram,
    logo: '/integrations/instagram.svg',
    category: INTEGRATION_CATEGORIES.SOCIAL,
    isActive: true,
    requiresMarketing: true,
    connectionType: 'oauth',
    brandColor: '#E1306C',
    brandGradient: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)'
  },
  {
    id: 'facebook',
    name: 'Facebook Pages',
    description: 'Manage your Facebook Page content and respond to messages automatically',
    icon: Facebook,
    logo: '/integrations/facebook.svg',
    category: INTEGRATION_CATEGORIES.SOCIAL,
    isActive: true,
    requiresMarketing: true,
    connectionType: 'oauth',
    brandColor: '#1877F2'
  },

  // Marketing & Email - Active
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Sync customer data and send targeted email campaigns',
    icon: Mail,
    logo: '/integrations/mailchimp.svg',
    category: INTEGRATION_CATEGORIES.MARKETING,
    isActive: true,
    requiresMarketing: true,
    connectionType: 'api_key',
    brandColor: '#FFE01B',
    brandTextColor: '#000000',
    logoBg: '#FFE01B',
    fields: [
      {
        name: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'Enter your Mailchimp API key',
        required: true
      }
    ]
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Send automated messages and manage customer conversations',
    icon: MessageSquare,
    logo: '/integrations/whatsapp.svg',
    category: INTEGRATION_CATEGORIES.COMMUNICATION,
    isActive: true,
    requiresMarketing: true,
    connectionType: 'api_key',
    brandColor: '#25D366',
    fields: [
      {
        name: 'access_token',
        label: 'Access Token',
        type: 'password',
        placeholder: 'Enter your WhatsApp Cloud API Access Token',
        required: true
      },
      {
        name: 'phone_number_id',
        label: 'Phone Number ID',
        type: 'text',
        placeholder: 'Enter your WhatsApp Phone Number ID',
        required: true
      }
    ]
  },

  // Analytics - Active
  {
    id: 'google_analytics',
    name: 'Google Analytics 4',
    description: 'Track website performance and customer behavior insights',
    icon: BarChart3,
    logo: '/integrations/google_analytics.svg',
    category: INTEGRATION_CATEGORIES.ANALYTICS,
    isActive: true,
    connectionType: 'api_key',
    brandColor: '#E37400',
    fields: [
      {
        name: 'measurement_id',
        label: 'Measurement ID',
        type: 'text',
        placeholder: 'G-XXXXXXXXXX',
        required: true
      },
      {
        name: 'api_secret',
        label: 'API Secret',
        type: 'password',
        placeholder: 'Enter your Measurement Protocol API Secret',
        required: true
      }
    ]
  },

  // POS Systems - Now Active
  {
    id: 'square',
    name: 'Square',
    description: 'Connect Square POS for payment processing and sales sync',
    icon: CreditCard,
    logo: '/integrations/square.svg',
    category: INTEGRATION_CATEGORIES.POS,
    isActive: true,
    connectionType: 'api_key',
    brandColor: '#006838',
    fields: [
      {
        name: 'access_token',
        label: 'Square Access Token',
        type: 'password',
        placeholder: 'Enter your Square access token',
        required: true
      }
    ]
  },
  {
    id: 'lightspeed',
    name: 'Lightspeed',
    description: 'Connect Lightspeed POS for inventory and order sync',
    icon: Monitor,
    logo: '/integrations/lightspeed.svg',
    category: INTEGRATION_CATEGORIES.POS,
    isActive: true,
    connectionType: 'api_key',
    brandColor: '#0066FF',
    fields: [
      {
        name: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'Enter your Lightspeed API key',
        required: true
      }
    ]
  },
  {
    id: 'clover',
    name: 'Clover POS',
    description: 'Integrate with Clover POS for real-time order sync',
    icon: CreditCard,
    logo: '/integrations/clover.svg',
    category: INTEGRATION_CATEGORIES.POS,
    isActive: true,
    connectionType: 'api_key',
    brandColor: '#A6CE39',
    fields: [
      {
        name: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'Enter your Clover API key',
        required: true
      }
    ]
  },

  // Social - Now Active
  {
    id: 'tiktok',
    name: 'TikTok for Business',
    description: 'Create and manage TikTok content for your restaurant',
    icon: MessageSquare,
    logo: '/integrations/tiktok.svg',
    category: INTEGRATION_CATEGORIES.SOCIAL,
    isActive: true,
    requiresMarketing: true,
    connectionType: 'oauth',
    brandColor: '#000000',
    brandTextColor: '#FFFFFF'
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Pages',
    description: 'Professional networking and business content sharing',
    icon: Briefcase,
    logo: '/integrations/linkedin.svg',
    category: INTEGRATION_CATEGORIES.SOCIAL,
    isActive: true,
    requiresMarketing: true,
    connectionType: 'oauth',
    brandColor: '#0A66C2'
  },

  // Marketing & Email - Now Active
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send personalized emails directly from your Gmail account',
    icon: Mail,
    logo: '/integrations/gmail.svg',
    category: INTEGRATION_CATEGORIES.MARKETING,
    isActive: true,
    requiresMarketing: true,
    connectionType: 'oauth',
    brandColor: '#EA4335'
  },
  {
    id: 'meta_ads',
    name: 'Meta Ads Manager',
    description: 'Create and manage Facebook and Instagram advertising campaigns',
    icon: Facebook,
    logo: '/integrations/meta_ads.svg',
    category: INTEGRATION_CATEGORIES.MARKETING,
    isActive: true,
    requiresMarketing: true,
    connectionType: 'oauth',
    brandColor: '#0866FF'
  },
  {
    id: 'google_ads',
    name: 'Google Ads',
    description: 'Manage Google Ads campaigns and track performance',
    icon: BarChart3,
    logo: '/integrations/google_ads.svg',
    category: INTEGRATION_CATEGORIES.MARKETING,
    isActive: true,
    requiresMarketing: true,
    connectionType: 'oauth',
    brandColor: '#4285F4'
  },

  // Communication - Now Active
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team communication and automated notifications',
    icon: Slack,
    logo: '/integrations/slack.svg',
    category: INTEGRATION_CATEGORIES.COMMUNICATION,
    isActive: true,
    connectionType: 'oauth',
    brandColor: '#4A154B'
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Video conferencing and team collaboration',
    icon: MessageSquare,
    logo: '/integrations/teams.svg',
    category: INTEGRATION_CATEGORIES.COMMUNICATION,
    isActive: true,
    connectionType: 'oauth',
    brandColor: '#6264A7'
  },
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Schedule and manage video conferences',
    icon: MessageSquare,
    logo: '/integrations/zoom.svg',
    category: INTEGRATION_CATEGORIES.COMMUNICATION,
    isActive: true,
    connectionType: 'oauth',
    brandColor: '#2D8CFF'
  },

  // Accounting - Now Active
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync sales data and manage accounting automatically',
    icon: Calculator,
    logo: '/integrations/quickbooks.svg',
    category: INTEGRATION_CATEGORIES.ACCOUNTING,
    isActive: true,
    connectionType: 'oauth',
    brandColor: '#2CA01C'
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Cloud-based accounting and financial management',
    icon: Calculator,
    logo: '/integrations/xero.svg',
    category: INTEGRATION_CATEGORIES.ACCOUNTING,
    isActive: true,
    connectionType: 'oauth',
    brandColor: '#13B5EA'
  },
  {
    id: 'sage',
    name: 'Sage Accounting',
    description: 'Professional accounting software integration',
    icon: Calculator,
    logo: '/integrations/sage.svg',
    category: INTEGRATION_CATEGORIES.ACCOUNTING,
    isActive: true,
    connectionType: 'oauth',
    brandColor: '#00DC00'
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Process payments and manage transactions',
    icon: CreditCard,
    logo: '/integrations/stripe.svg',
    category: INTEGRATION_CATEGORIES.ACCOUNTING,
    isActive: true,
    connectionType: 'oauth',
    brandColor: '#635BFF'
  },

  // Legal & HR - Now Active
  {
    id: 'docusign',
    name: 'DocuSign',
    description: 'Electronic signatures for contracts and agreements',
    icon: FileText,
    logo: '/integrations/docusign.svg',
    category: INTEGRATION_CATEGORIES.LEGAL_HR,
    isActive: true,
    connectionType: 'oauth',
    brandColor: '#FFCC22',
    brandTextColor: '#000000'
  },
  {
    id: 'bamboohr',
    name: 'BambooHR',
    description: 'Human resources management and employee records',
    icon: Users,
    logo: '/integrations/bamboohr.svg',
    category: INTEGRATION_CATEGORIES.LEGAL_HR,
    isActive: true,
    connectionType: 'oauth',
    brandColor: '#7CC242'
  },
  {
    id: 'gusto',
    name: 'Gusto',
    description: 'Payroll, benefits, and HR management',
    icon: Users,
    category: INTEGRATION_CATEGORIES.LEGAL_HR,
    isActive: true,
    connectionType: 'oauth',
    brandColor: '#B85450'
  },
  {
    id: 'calendly',
    name: 'Calendly',
    description: 'Schedule meetings and manage appointments',
    icon: Calendar,
    logo: '/integrations/calendly.svg',
    category: INTEGRATION_CATEGORIES.LEGAL_HR,
    isActive: true,
    connectionType: 'oauth',
    brandColor: '#006BFF'
  },

  // Developer - Now Active
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Automate workflows between different applications',
    icon: Code,
    logo: '/integrations/zapier.svg',
    category: INTEGRATION_CATEGORIES.DEVELOPER,
    isActive: true,
    connectionType: 'webhook',
    brandColor: '#FF4A00'
  },
  {
    id: 'webhooks',
    name: 'Custom Webhooks',
    description: 'Send data to external systems via custom webhooks',
    icon: Code,
    category: INTEGRATION_CATEGORIES.DEVELOPER,
    isActive: true,
    connectionType: 'webhook',
    brandColor: '#6B7280'
  }
];

export const getIntegrationsByCategory = (category: string) => {
  return integrationsRegistry.filter(integration => integration.category === category);
};

export const getActiveIntegrations = () => {
  return integrationsRegistry.filter(integration => integration.isActive);
};

export const getComingSoonIntegrations = () => {
  return integrationsRegistry.filter(integration => integration.comingSoon);
};

export const getMarketingIntegrations = () => {
  return integrationsRegistry.filter(integration => integration.requiresMarketing);
};