import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Shield, 
  Database, 
  Users, 
  Receipt, 
  Menu, 
  CreditCard,
  Eye,
  EyeOff,
  Info,
  Lock
} from 'lucide-react';

interface PermissionOption {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  category: 'essential' | 'optional' | 'advanced';
  enabled: boolean;
  details: string[];
  risk: 'low' | 'medium' | 'high';
}

interface PermissionGranularityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (permissions: Record<string, boolean>) => void;
  posSystemName: string;
  currentPermissions?: Record<string, boolean>;
}

const defaultPermissions: PermissionOption[] = [
  // Essential Permissions
  {
    id: 'menu_read',
    name: 'Menu Data (Read)',
    description: 'Import your existing menu structure from POS',
    icon: Menu,
    category: 'essential',
    enabled: true,
    details: ['Category names', 'Item names', 'Prices', 'Descriptions'],
    risk: 'low'
  },
  {
    id: 'table_data',
    name: 'Table Configuration',
    description: 'Import table numbers and basic layout from POS',
    icon: Database,
    category: 'essential',
    enabled: true,
    details: ['Table numbers', 'Seating capacity', 'Location/section names'],
    risk: 'low'
  },

  // Optional Permissions
  {
    id: 'order_status',
    name: 'Order Status Updates',
    description: 'Receive real-time order status changes from POS',
    icon: Receipt,
    category: 'optional',
    enabled: true,
    details: ['Order placed notifications', 'Order completion status', 'Bill payment status'],
    risk: 'medium'
  },
  {
    id: 'customer_data',
    name: 'Customer Information',
    description: 'Access customer names and contact details',
    icon: Users,
    category: 'optional',
    enabled: false,
    details: ['Customer names', 'Phone numbers', 'Email addresses (if available)'],
    risk: 'medium'
  },
  {
    id: 'menu_write',
    name: 'Menu Data (Write)',
    description: 'Allow AIPOS to update menu items back to POS',
    icon: Menu,
    category: 'optional',
    enabled: false,
    details: ['Update item descriptions', 'Modify prices', 'Add new items'],
    risk: 'medium'
  },

  // Advanced Permissions
  {
    id: 'financial_data',
    name: 'Sales & Revenue Data',
    description: 'Access detailed financial information for analytics',
    icon: CreditCard,
    category: 'advanced',
    enabled: false,
    details: ['Individual order totals', 'Payment methods', 'Revenue analytics', 'Per-table earnings'],
    risk: 'high'
  },
  {
    id: 'inventory_data',
    name: 'Inventory Information',
    description: 'Access stock levels and ingredient data',
    icon: Database,
    category: 'advanced',
    enabled: false,
    details: ['Stock quantities', 'Ingredient lists', 'Low stock alerts'],
    risk: 'medium'
  }
];

const PermissionGranularityModal: React.FC<PermissionGranularityModalProps> = ({
  isOpen,
  onClose,
  onSave,
  posSystemName,
  currentPermissions = {}
}) => {
  const [permissions, setPermissions] = useState<PermissionOption[]>(() => 
    defaultPermissions.map(permission => ({
      ...permission,
      enabled: currentPermissions[permission.id] ?? permission.enabled
    }))
  );

  const handlePermissionChange = (permissionId: string, enabled: boolean) => {
    setPermissions(prev => 
      prev.map(permission => 
        permission.id === permissionId ? { ...permission, enabled } : permission
      )
    );
  };

  const handleSave = () => {
    const permissionMap = permissions.reduce((acc, permission) => {
      acc[permission.id] = permission.enabled;
      return acc;
    }, {} as Record<string, boolean>);
    
    onSave(permissionMap);
    onClose();
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'essential':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800';
      case 'optional':
        return 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800';
      case 'advanced':
        return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
      default:
        return 'bg-card';
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Low Risk</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Medium Risk</Badge>;
      case 'high':
        return <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">High Risk</Badge>;
      default:
        return null;
    }
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'essential':
        return 'Essential Permissions';
      case 'optional':
        return 'Optional Permissions';
      case 'advanced':
        return 'Advanced Permissions';
      default:
        return 'Permissions';
    }
  };

  const getCategoryDescription = (category: string) => {
    switch (category) {
      case 'essential':
        return 'Required for basic functionality';
      case 'optional':
        return 'Enhances features but not required';
      case 'advanced':
        return 'Full integration with sensitive data access';
      default:
        return '';
    }
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, PermissionOption[]>);

  const enabledCount = permissions.filter(p => p.enabled).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Data Sharing Preferences
          </DialogTitle>
          <DialogDescription>
            Choose what data you want to share with <strong>{posSystemName}</strong>. 
            You can change these settings at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {enabledCount} of {permissions.length} permissions enabled
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="w-4 h-4" />
                <span>All data is encrypted and secure</span>
              </div>
            </div>
          </div>

          {/* Permission Categories */}
          {(['essential', 'optional', 'advanced'] as const).map(category => {
            const categoryPermissions = groupedPermissions[category] || [];
            if (categoryPermissions.length === 0) return null;

            return (
              <div key={category} className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">{getCategoryTitle(category)}</h3>
                  <p className="text-sm text-muted-foreground">{getCategoryDescription(category)}</p>
                </div>

                <div className="space-y-3">
                  {categoryPermissions.map((permission) => {
                    const IconComponent = permission.icon;
                    
                    return (
                      <Card key={permission.id} className={getCategoryColor(category)}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-background rounded-lg">
                                <IconComponent className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <CardTitle className="text-sm">{permission.name}</CardTitle>
                                  {getRiskBadge(permission.risk)}
                                </div>
                                <CardDescription className="text-xs">
                                  {permission.description}
                                </CardDescription>
                              </div>
                            </div>
                            <Switch
                              checked={permission.enabled}
                              onCheckedChange={(enabled) => handlePermissionChange(permission.id, enabled)}
                            />
                          </div>
                        </CardHeader>
                        
                        {permission.enabled && (
                          <CardContent className="pt-0">
                            <div className="bg-background/50 p-3 rounded border">
                              <div className="flex items-center gap-2 mb-2">
                                <Eye className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">
                                  This will give access to:
                                </span>
                              </div>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {permission.details.map((detail, index) => (
                                  <li key={index} className="flex items-center gap-2">
                                    <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                                    {detail}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </CardContent>
                        )}

                        {!permission.enabled && permission.category !== 'essential' && (
                          <CardContent className="pt-0">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <EyeOff className="w-3 h-3" />
                              <span>No data will be shared for this feature</span>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            You can modify these permissions anytime in Settings
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Preferences
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PermissionGranularityModal;