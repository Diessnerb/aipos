import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import PermissionGuard from '@/components/PermissionGuard';
import SettingsNavigationButton from '@/components/settings/SettingsNavigationButton';
import DeleteAccountModal from '@/components/settings/DeleteAccountModal';
import { useTableServiceSchedules } from '@/hooks/useTableServiceSchedules';
import { 
  Settings as SettingsIcon, 
  Building2, 
  Phone, 
  Globe,
  Users, 
  Palette, 
  FileText, 
  Plug, 
  Menu,
  Shield,
  TableProperties,
  MapPin,
  Monitor,
  LogOut,
  AlertTriangle,
  Trash2,
  Bell,
  Clock,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clearPinUser } from '@/utils/pinAuth';
import { getBoundCompany, clearBoundCompany, setBoundCompany } from '@/utils/deviceBinding';
import { setUILock } from '@/utils/secureStorage';
import { supabase } from '@/integrations/supabase/client';
import AuthenticationModal from '@/components/settings/AuthenticationModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReconnectionManager } from '@/device/ReconnectionManager';
import { DeviceDataManager } from '@/device/DeviceDataManager';
import { runBoundHealthCheck } from '@/utils/boundHealthCheck';
import { useQueryClient } from '@tanstack/react-query';

const Settings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUnbindAuthOpen, setIsUnbindAuthOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { tablesRequiringAttention } = useTableServiceSchedules();
  
  const boundCompany = getBoundCompany();
  
  const notificationCount = tablesRequiringAttention.length;

  const settingsOptions = [
    {
      title: "Company Details", 
      description: "Company info, location, timezone, and session settings",
      icon: Building2,
      href: "/settings/company-details",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Team Members",
      description: "Manage staff accounts and permissions",
      icon: Users,
      href: "/settings/team-members",
      color: "text-orange-600", 
      bgColor: "bg-orange-50"
    },
    {
      title: "Access Levels",
      description: "PIN management and page permissions",
      icon: Shield,
      href: "/settings/access-levels",
      color: "text-red-600",
      bgColor: "bg-red-50"
    },
    {
      title: "Branding",
      description: "Colors, logos, and visual identity",
      icon: Palette,
      href: "/settings/branding",
      color: "text-pink-600",
      bgColor: "bg-pink-50"
    },
    {
      title: "Legal & Policy",
      description: "Terms, privacy policy, and compliance",
      icon: FileText,
      href: "/settings/legal-policy",
      color: "text-gray-600",
      bgColor: "bg-gray-50"
    },
    {
      title: "Integrations",
      description: "Third-party services and API connections",
      icon: Plug,
      href: "/settings/integrations",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50"
    },
    {
      title: "Menu Settings",
      description: "Menu structure and item management",
      icon: Menu,
      href: "/settings/menu",
      color: "text-teal-600",
      bgColor: "bg-teal-50"
    },
    {
      title: "Tables & Table Groups",
      description: "Automatic table assignment rules",
      icon: TableProperties,
      href: "/settings/table-assignment",
      color: "text-cyan-600",
      bgColor: "bg-cyan-50"
    },
    {
      title: "Opening Hours",
      description: "Operating hours and food service times",
      icon: Clock,
      href: "/settings/opening-hours",
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Device Settings",
      description: "Tablet location and device configuration",
      icon: MapPin,
      href: "/settings/device",
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Display & Scaling",
      description: "Adjust how content is displayed on your device",
      icon: Monitor,
      href: "/settings/display-scale",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50"
    }
  ];

  const handleLogout = () => {
    clearPinUser();
    setUILock(true);
    toast({
      title: "Logged out successfully",
      description: "You have been logged out. Please enter your PIN to continue.",
    });
    navigate('/login');
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      
      // Step 1: Validate binding
      const boundCompany = getBoundCompany();
      if (!boundCompany?.company_id) {
        toast({ 
          title: "Device not bound", 
          description: "Please bind device through owner login",
          variant: "destructive" 
        });
        navigate('/owner-login');
        setIsRefreshing(false);
        return;
      }
      
      toast({ title: "Refreshing...", description: "Step 1/5: Validating device binding" });
      console.log('🔄 Bound company:', boundCompany);
      
      // Step 2: Trigger reconnection
      toast({ title: "Refreshing...", description: "Step 2/5: Re-establishing connection" });
      const reconnected = await ReconnectionManager.handleReconnection();
      if (!reconnected) {
        throw new Error('Reconnection failed');
      }
      
      // Step 3: Ensure critical caches
      toast({ title: "Refreshing...", description: "Step 3/5: Loading critical data" });
      await DeviceDataManager.ensureCriticalCaches(boundCompany.company_id);
      
      // Step 4: Run health check
      toast({ title: "Refreshing...", description: "Step 4/5: Validating data services" });
      const healthResults = await runBoundHealthCheck(boundCompany.company_id);
      
      // Step 5: Invalidate all queries to force refetch
      toast({ title: "Refreshing...", description: "Step 5/5: Refreshing all data" });
      queryClient.invalidateQueries();
      
      // Summary
      const successCount = healthResults.filter(r => r.success).length;
      const failCount = healthResults.filter(r => !r.success).length;
      const totalItems = healthResults.reduce((sum, r) => sum + (r.count || 0), 0);
      
      if (failCount === 0) {
        toast({
          title: "✅ Refresh Complete",
          description: `All systems operational. Loaded ${totalItems} items across ${successCount} services.`,
        });
      } else {
        toast({
          title: "⚠️ Partial Success",
          description: `${successCount}/${healthResults.length} services OK. ${failCount} service(s) unavailable.`,
          variant: "default",
        });
      }
      
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      toast({
        title: "Refresh Failed",
        description: "Connection or data loading issue. Try owner login if this persists.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUnbindDevice = async () => {
    try {
      // Clear all local data (auth was already verified by AuthenticationModal)
      clearPinUser();
      clearBoundCompany();
      setUILock(true);

      // Sign out from Supabase
      await supabase.auth.signOut();

      setIsUnbindAuthOpen(false);
      
      toast({
        title: "Device Unbound",
        description: "This device is no longer bound to any company. You'll need to bind it again to continue using the system.",
      });
      
      navigate('/owner-login');
    } catch (error: any) {
      toast({
        title: "Unbind Failed",
        description: error.message || "Failed to unbind device. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <PermissionGuard route="/settings" requiredPermission="view">
      <div className="h-full flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <div className="flex-shrink-0 p-3 sm:p-4 lg:p-6 pb-0">
          <PageHeader 
            title="Company Settings" 
            subtitle="Manage your company information, integrations, and team settings" 
          />
        </div>

        {/* Scrollable Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-3 sm:p-4 lg:p-6 pt-3 sm:pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {settingsOptions.map((option, index) => (
                <div key={index} className="relative">
                  <SettingsNavigationButton
                    title={option.title}
                    description={option.description}
                    icon={<option.icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />}
                    onClick={() => navigate(option.href)}
                  />
                  {option.title === "Tables & Table Groups" && notificationCount > 0 && (
                    <div className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs font-bold shadow-lg z-10 animate-pulse">
                      {notificationCount}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        {/* Fixed Footer with Alert and Action Buttons */}
        <div className="flex-shrink-0 border-t bg-white p-3 sm:p-4 lg:p-6">
          <div className="space-y-4 max-w-4xl mx-auto">
            {boundCompany && (
              <Alert className="mx-auto max-w-2xl">
                <Building2 className="h-4 w-4" />
                <AlertDescription>
                  This tablet is bound to <strong>{boundCompany.company_name}</strong>. 
                  Unbinding will remove all local data and require re-setup.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                variant="outline"
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout (PIN Only)
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setIsUnbindAuthOpen(true)}
                className="flex items-center gap-2 bg-white border-2 border-yellow-400 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700"
              >
                <AlertTriangle className="w-4 h-4" />
                Unbind Device
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 bg-white border-2 border-red-400 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Delete Account
              </Button>
            </div>
          </div>
        </div>

        {/* Modals */}
        <AuthenticationModal
          isOpen={isUnbindAuthOpen}
          onClose={() => setIsUnbindAuthOpen(false)}
          onAuthenticated={handleUnbindDevice}
          title="Verify Identity to Unbind Device"
          description={`Please enter your account credentials to unbind this device from ${boundCompany?.company_name}. This will remove all local data and you'll need to bind the device again to continue using the system.`}
          actionButtonText="Unbind Device"
          actionButtonVariant="destructive"
        />

        <DeleteAccountModal 
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
        />

        {/* Refresh button in bottom right corner */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="fixed bottom-6 right-6 opacity-50 hover:opacity-80 transition-opacity text-xs text-muted-foreground border-0 z-50"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Binding
        </Button>
      </div>
    </PermissionGuard>
  );
};

export default Settings;