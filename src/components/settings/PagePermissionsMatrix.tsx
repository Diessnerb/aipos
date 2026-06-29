import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Shield, Info, Save, Download, RotateCcw, FolderOpen } from 'lucide-react';
import { usePagePermissions } from '@/hooks/usePagePermissions';
import { usePermissionTemplates } from '@/hooks/usePermissionTemplates';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { SaveTemplateModal } from './SaveTemplateModal';
import { LoadTemplateModal } from './LoadTemplateModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { PERMISSION_PAGES } from '@/config/permissionPages';

// Get modules list from centralized configuration
const MODULES = PERMISSION_PAGES.map(page => ({
  key: page.key,
  label: page.label
}));

const ACCESS_LEVELS: Array<'staff' | 'manager' | 'admin'> = ['staff', 'manager', 'admin'];

const PERMISSION_OPTIONS = [
  { value: 'no_access', label: 'No Access' },
  { value: 'view', label: 'View' },
  { value: 'growth', label: 'Growth' },
  { value: 'edit', label: 'Edit' },
  { value: 'admin', label: 'Admin' },
] as const;

const normalizePage = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '_');

const PagePermissionsMatrix: React.FC = () => {
  const { permissions, loading, updatePermission, addPermission, deletePermission, isOwner, refetch } = usePagePermissions();
  const { 
    templates, 
    loading: templatesLoading, 
    fetchTemplates, 
    saveTemplate, 
    loadTemplate, 
    resetToSystemDefaults, 
    deleteTemplate 
  } = usePermissionTemplates();
  const { toast } = useToast();

  // Modal states
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Template management handlers
  const handleSaveTemplate = async (templateName: string) => {
    const success = await saveTemplate(templateName);
    return success;
  };

  const handleLoadTemplate = async (templateId: string) => {
    const success = await loadTemplate(templateId);
    if (success) {
      await refetch(); // Refresh permissions after loading template
    }
    return success;
  };

  const handleResetToDefaults = async () => {
    const success = await resetToSystemDefaults();
    if (success) {
      await refetch(); // Refresh permissions after reset
    }
    setIsResetDialogOpen(false);
    return success;
  };

  const indexByPageAndLevel = useMemo(() => {
    const map = new Map<string, (typeof permissions)[number]>();
    for (const p of permissions) {
      map.set(`${normalizePage(p.page_name)}|${p.access_level}`, p);
    }
    return map;
  }, [permissions]);

  const getValue = useCallback(
    (pageKey: string, level: 'staff' | 'manager' | 'admin') => {
      const p = indexByPageAndLevel.get(`${pageKey}|${level}`);
      return (p?.permission_type as 'no_access' | 'view' | 'growth' | 'edit' | 'admin') ?? 'no_access';
    },
    [indexByPageAndLevel]
  );

  const handleChange = useCallback(
    async (
      pageKey: string,
      level: 'staff' | 'manager' | 'admin',
      newValue: 'no_access' | 'view' | 'growth' | 'edit' | 'admin'
    ) => {
      const updateKey = `${pageKey}|${level}`;
      
      // Prevent concurrent updates to same field
      if (isUpdating === updateKey) {
        console.log('Update already in progress, skipping');
        return;
      }
      
      setIsUpdating(updateKey);
      const existing = indexByPageAndLevel.get(updateKey);

      try {
        if (newValue === 'no_access') {
          if (existing) {
            await deletePermission(existing.id);
            toast({ title: 'Permission removed', description: `${pageKey.replace(/_/g, ' ')} (${level}) set to No Access.` });
          }
        } else {
          if (existing) {
            await updatePermission(existing.id, newValue);
            toast({ title: 'Permission updated', description: `${pageKey.replace(/_/g, ' ')} (${level}) → ${newValue}.` });
          } else {
            await addPermission(pageKey, level, newValue);
            toast({ title: 'Permission added', description: `${pageKey.replace(/_/g, ' ')} (${level}) → ${newValue}.` });
          }
        }
        
        // Force refetch after successful change to ensure UI sync
        await refetch();
      } catch (e) {
        toast({ title: 'Action failed', description: 'Please try again.', variant: 'destructive' });
      } finally {
        // Clear updating state after a delay to allow state to settle
        setTimeout(() => {
          setIsUpdating(null);
        }, 500);
      }
    },
    [indexByPageAndLevel, addPermission, updatePermission, deletePermission, toast, refetch, isUpdating]
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Page Permissions
          </CardTitle>
          <CardDescription>Manage access for each role using the matrix below.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="grid grid-cols-4 gap-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-28" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Page Permissions
        </CardTitle>
        <CardDescription>Set page access per role. Owners always have full access and are unaffected by these settings.</CardDescription>
      </CardHeader>
      <CardContent>
        {isOwner && (
          <div className="mb-4 flex items-start gap-2 text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5" />
            <p>Owner PIN is active: you can edit these permissions for staff, managers and admins. Owners always bypass restrictions.</p>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">Page</TableHead>
              {ACCESS_LEVELS.map((lvl) => (
                <TableHead key={lvl} className="capitalize">
                  <div className="flex items-center gap-2">
                    <Badge variant={lvl === 'admin' ? 'default' : lvl === 'manager' ? 'secondary' : 'outline'}>
                      {lvl}
                    </Badge>
                    <span>Access</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {MODULES.map((mod) => (
              <TableRow key={mod.key}>
                <TableCell className="font-medium">{mod.label}</TableCell>
                {ACCESS_LEVELS.map((lvl) => {
                  const current = getValue(mod.key, lvl);
                  return (
                    <TableCell key={lvl}>
                      <Select
                        value={current}
                        onValueChange={(v: any) => handleChange(mod.key, lvl, v)}
                        disabled={isUpdating === `${mod.key}|${lvl}`}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-50">
                          {PERMISSION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Template Management Section */}
        <div className="mt-6">
          <Separator className="mb-4" />
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Permission Templates</h3>
                <p className="text-xs text-muted-foreground">Save, load, or reset permission configurations</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSaveModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save as Template
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsLoadModalOpen(true)}
                className="flex items-center gap-2"
                disabled={templatesLoading}
              >
                <FolderOpen className="h-4 w-4" />
                Load Template
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsResetDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset to Defaults
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-2 text-sm text-muted-foreground">
          <div className="flex flex-wrap gap-4">
            <span className="font-medium">Legend:</span>
            <span>View = read-only</span>
            <span>Growth = create/update</span>
            <span>Edit = growth + delete</span>
            <span>Admin = edit + admin actions</span>
          </div>
        </div>

        {/* Modals */}
        <SaveTemplateModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          onSave={handleSaveTemplate}
        />

        <LoadTemplateModal
          isOpen={isLoadModalOpen}
          onClose={() => setIsLoadModalOpen(false)}
          onLoad={handleLoadTemplate}
          onDelete={deleteTemplate}
          templates={templates}
          onFetchTemplates={fetchTemplates}
        />

        <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset to System Defaults</AlertDialogTitle>
              <AlertDialogDescription>
                This will replace all current permission settings with the system default configuration.
                This action cannot be undone. Are you sure you want to continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetToDefaults}>
                Reset to Defaults
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default PagePermissionsMatrix;
