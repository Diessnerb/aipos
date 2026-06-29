import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Loader2
} from 'lucide-react';
import { featureSections, FeatureSection } from '@/config/featureManagementConfig';
import { 
  fetchCompanyFeatureData, 
  updatePageFeature, 
  updateCompanySetting,
  updateDeliverySetting,
  CompanyFeatureData 
} from '@/services/companyFeatureManagement';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FeatureManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
}

export const FeatureManagementModal: React.FC<FeatureManagementModalProps> = ({
  isOpen,
  onClose,
  companyId,
  companyName,
}) => {
  const [selectedSection, setSelectedSection] = useState<string>('reservations');
  const [featureData, setFeatureData] = useState<CompanyFeatureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingKeys, setUpdatingKeys] = useState<Set<string>>(new Set());

  // Load feature data when modal opens
  useEffect(() => {
    if (isOpen && companyId) {
      loadFeatureData();
    }
  }, [isOpen, companyId]);

  const loadFeatureData = async () => {
    setLoading(true);
    try {
      const data = await fetchCompanyFeatureData(companyId);
      setFeatureData(data);
    } catch (error) {
      console.error('Failed to load feature data:', error);
      toast.error('Failed to load feature settings');
    } finally {
      setLoading(false);
    }
  };

  const handlePageToggle = async (pageFeature: string, enabled: boolean) => {
    if (!featureData) return;

    const updateKey = `feature-${pageFeature}`;
    setUpdatingKeys(prev => new Set([...prev, updateKey]));

    try {
      await updatePageFeature(companyId, pageFeature, enabled);
      
      // Update local state
      setFeatureData(prev => prev ? {
        ...prev,
        features: { ...prev.features, [pageFeature]: enabled }
      } : null);

      toast.success(`${pageFeature} page ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to update page feature:', error);
      toast.error('Failed to update page access');
    } finally {
      setUpdatingKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(updateKey);
        return newSet;
      });
    }
  };

  const handleAutomationToggle = async (
    key: string, 
    value: boolean, 
    source: 'settings' | 'features'
  ) => {
    if (!featureData) return;

    const updateKey = `${source}-${key}`;
    setUpdatingKeys(prev => new Set([...prev, updateKey]));

    try {
      if (source === 'settings') {
        // Check if it's a delivery setting
        const deliveryKeys = ['enable_auto_ordering', 'notify_on_low_stock', 'notify_on_order_received'];
        if (deliveryKeys.includes(key)) {
          await updateDeliverySetting(companyId, key, value);
        } else {
          await updateCompanySetting(companyId, key, value);
        }
      }
      
      // Update local state
      setFeatureData(prev => prev ? {
        ...prev,
        settings: { ...prev.settings, [key]: value }
      } : null);

      toast.success(`Setting updated successfully`);
    } catch (error) {
      console.error('Failed to update automation:', error);
      toast.error('Failed to update automation setting');
    } finally {
      setUpdatingKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(updateKey);
        return newSet;
      });
    }
  };

  const getCurrentSection = (): FeatureSection | undefined => {
    return featureSections.find(s => s.id === selectedSection);
  };

  const section = getCurrentSection();
  const isPageEnabled = featureData?.features[section?.pageFeature || ''] ?? false;

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl h-[80vh]">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Feature Management - {companyName}</DialogTitle>
          <DialogDescription>
            Control page access, automations, and features for this restaurant
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r bg-muted/30">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-1">
                <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">
                  PAGES
                </div>
                {featureSections.filter(s => s.id !== 'system').map((section) => {
                  const Icon = section.icon;
                  const isEnabled = featureData?.features[section.pageFeature] ?? false;
                  const isSelected = selectedSection === section.id;

                  return (
                    <button
                      key={section.id}
                      onClick={() => setSelectedSection(section.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                        isSelected 
                          ? "bg-background shadow-sm text-foreground font-medium" 
                          : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{section.name}</span>
                      {isEnabled ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      )}
                    </button>
                  );
                })}

                <Separator className="my-3" />

                <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">
                  SYSTEM
                </div>
                {featureSections.filter(s => s.id === 'system').map((section) => {
                  const Icon = section.icon;
                  const isSelected = selectedSection === section.id;

                  return (
                    <button
                      key={section.id}
                      onClick={() => setSelectedSection(section.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                        isSelected 
                          ? "bg-background shadow-sm text-foreground font-medium" 
                          : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{section.name}</span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                {section && (
                  <>
                    {/* Section Header */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <section.icon className="h-6 w-6 text-primary" />
                        <h3 className="text-xl font-semibold">{section.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {section.description}
                      </p>
                    </div>

                    <Separator />

                    {/* Page Access Toggle (except for system) */}
                    {section.id !== 'system' && (
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                          Page Access
                        </h4>
                        <div className={cn(
                          "flex items-center justify-between p-4 rounded-lg border",
                          isPageEnabled 
                            ? "bg-green-50/50 border-green-200" 
                            : "bg-muted/30 border-border"
                        )}>
                          <div className="flex items-center space-x-3">
                            <Switch
                              id={`page-${section.pageFeature}`}
                              checked={isPageEnabled}
                              onCheckedChange={(checked) => 
                                handlePageToggle(section.pageFeature, checked)
                              }
                              disabled={updatingKeys.has(`feature-${section.pageFeature}`)}
                            />
                            <div>
                              <Label 
                                htmlFor={`page-${section.pageFeature}`} 
                                className="text-base font-medium cursor-pointer"
                              >
                                Enable {section.name} Page
                              </Label>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {isPageEnabled 
                                  ? 'Users can access this page' 
                                  : 'Page is hidden from navigation'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {updatingKeys.has(`feature-${section.pageFeature}`) && (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            )}
                            <Badge variant={isPageEnabled ? "default" : "secondary"}>
                              {isPageEnabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>
                        </div>

                        {!isPageEnabled && (section.automations || section.features) && (
                          <Alert variant="default" className="bg-amber-50 border-amber-200">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800">
                              Enable page access to configure automations and features
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}

                    {/* Automations */}
                    {section.automations && section.automations.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                          Automations
                        </h4>
                        <div className="grid gap-3">
                          {section.automations.map((automation) => {
                            const value = featureData?.settings[automation.key] ?? automation.defaultValue ?? false;
                            const updateKey = `${automation.source}-${automation.key}`;
                            const isUpdating = updatingKeys.has(updateKey);
                            const isDisabled = section.id !== 'system' && !isPageEnabled;

                            return (
                              <div
                                key={automation.key}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                  isDisabled 
                                    ? "opacity-50 bg-muted/20"
                                    : value 
                                      ? "bg-blue-50/50 border-blue-200" 
                                      : "bg-card hover:bg-muted/30"
                                )}
                              >
                                <div className="flex items-center space-x-3 flex-1">
                                  <Switch
                                    id={automation.key}
                                    checked={value}
                                    onCheckedChange={(checked) => 
                                      handleAutomationToggle(automation.key, checked, automation.source)
                                    }
                                    disabled={isUpdating || isDisabled}
                                  />
                                  <div className="flex-1">
                                    <Label 
                                      htmlFor={automation.key} 
                                      className="text-sm font-medium cursor-pointer"
                                    >
                                      {automation.label}
                                    </Label>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {automation.description}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isUpdating && (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                  )}
                                  <Badge 
                                    variant={value ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {value ? 'Active' : 'Inactive'}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Features */}
                    {section.features && section.features.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                          Features
                        </h4>
                        <div className="grid gap-3">
                          {section.features.map((feature) => {
                            const value = featureData?.settings[feature.key] ?? feature.defaultValue ?? false;
                            const updateKey = `${feature.source}-${feature.key}`;
                            const isUpdating = updatingKeys.has(updateKey);
                            const isDisabled = section.id !== 'system' && !isPageEnabled;

                            return (
                              <div
                                key={feature.key}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                  isDisabled 
                                    ? "opacity-50 bg-muted/20"
                                    : value 
                                      ? "bg-purple-50/50 border-purple-200" 
                                      : "bg-card hover:bg-muted/30"
                                )}
                              >
                                <div className="flex items-center space-x-3 flex-1">
                                  <Switch
                                    id={feature.key}
                                    checked={value}
                                    onCheckedChange={(checked) => 
                                      handleAutomationToggle(feature.key, checked, feature.source)
                                    }
                                    disabled={isUpdating || isDisabled}
                                  />
                                  <div className="flex-1">
                                    <Label 
                                      htmlFor={feature.key} 
                                      className="text-sm font-medium cursor-pointer"
                                    >
                                      {feature.label}
                                    </Label>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {feature.description}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isUpdating && (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                  )}
                                  <Badge 
                                    variant={value ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {value ? 'Enabled' : 'Disabled'}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Show message when no toggles available */}
                    {!section.automations?.length && 
                     !section.features?.length && 
                     !section.advancedSettings?.length && 
                     section.id !== 'system' && (
                      <Alert>
                        <AlertDescription>
                          No additional configuration options available for this page yet.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="border-t p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Changes are saved automatically
                </p>
                <Button onClick={onClose} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
