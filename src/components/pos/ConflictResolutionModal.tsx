import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, ArrowRight, CheckCircle2, GitMerge } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface SyncConflict {
  entityId: string;
  entityType: 'menu_item' | 'menu_category';
  conflictReason: string;
  localData: any;
  remoteData: any;
  resolution?: 'keep_local' | 'keep_remote' | 'merge';
}

interface ConflictResolutionModalProps {
  conflicts: SyncConflict[];
  open: boolean;
  onClose: () => void;
  onResolveConflict: (conflict: SyncConflict, resolution: 'keep_local' | 'keep_remote' | 'merge') => Promise<void>;
  onResolveAllConflicts: (resolutions: Array<{ conflict: SyncConflict; resolution: 'keep_local' | 'keep_remote' | 'merge' }>) => Promise<void>;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  conflicts,
  open,
  onClose,
  onResolveConflict,
  onResolveAllConflicts
}) => {
  const [resolutions, setResolutions] = useState<Record<string, 'keep_local' | 'keep_remote' | 'merge'>>({});
  const [resolving, setResolving] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);

  const handleResolutionChange = (conflictId: string, resolution: 'keep_local' | 'keep_remote' | 'merge') => {
    setResolutions(prev => ({ ...prev, [conflictId]: resolution }));
  };

  const handleResolveAll = async () => {
    setResolving(true);
    try {
      const resolutionArray = conflicts.map(conflict => ({
        conflict,
        resolution: resolutions[conflict.entityId] || 'keep_local'
      }));
      
      await onResolveAllConflicts(resolutionArray);
      setResolutions({});
      onClose();
    } catch (error) {
      console.error('Failed to resolve conflicts:', error);
    } finally {
      setResolving(false);
    }
  };

  const handleResolveSingle = async (conflict: SyncConflict, resolution: 'keep_local' | 'keep_remote' | 'merge') => {
    setResolving(true);
    try {
      await onResolveConflict(conflict, resolution);
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setResolving(false);
    }
  };

  const getConflictIcon = (reason: string) => {
    switch (reason) {
      case 'price_mismatch':
        return '💰';
      case 'name_mismatch':
        return '📝';
      case 'category_mismatch':
        return '📁';
      case 'description_mismatch':
        return '📄';
      default:
        return '⚠️';
    }
  };

  const renderDataComparison = (local: any, remote: any, conflict: SyncConflict) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              Local Version
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><strong>Name:</strong> {local.name}</div>
            <div><strong>Price:</strong> ${local.price?.toFixed(2) || '0.00'}</div>
            <div><strong>Description:</strong> {local.description || 'No description'}</div>
            <div><strong>Category:</strong> {local.category_name || local.category_id || 'None'}</div>
            <div><strong>Status:</strong> 
              <Badge variant={local.is_active ? "default" : "secondary"} className="ml-2">
                {local.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              POS Version
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><strong>Name:</strong> {remote.name}</div>
            <div><strong>Price:</strong> ${remote.price?.toFixed(2) || '0.00'}</div>
            <div><strong>Description:</strong> {remote.description || 'No description'}</div>
            <div><strong>Category:</strong> {remote.category_name || remote.category_id || 'None'}</div>
            <div><strong>Status:</strong> 
              <Badge variant={remote.is_active ? "default" : "secondary"} className="ml-2">
                {remote.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleResolveSingle(conflict, 'keep_local')}
          disabled={resolving}
          className="text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          Keep Local
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleResolveSingle(conflict, 'merge')}
          disabled={resolving}
          className="text-purple-600 border-purple-200 hover:bg-purple-50"
        >
          <GitMerge className="w-4 h-4 mr-2" />
          Smart Merge
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleResolveSingle(conflict, 'keep_remote')}
          disabled={resolving}
          className="text-orange-600 border-orange-200 hover:bg-orange-50"
        >
          Keep POS
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Sync Conflicts Detected
          </DialogTitle>
          <DialogDescription>
            {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} found during synchronization. 
            Review and resolve each conflict to complete the sync process.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="list" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">Conflict List</TabsTrigger>
              <TabsTrigger value="detailed">Detailed View</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="flex-1 overflow-hidden">
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {conflicts.map((conflict, index) => (
                    <Card key={conflict.entityId} className="cursor-pointer hover:bg-muted/30" 
                          onClick={() => setSelectedConflict(conflict)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getConflictIcon(conflict.conflictReason)}</span>
                            <div>
                              <div className="font-medium">{conflict.localData.name}</div>
                              <div className="text-sm text-muted-foreground capitalize">
                                {conflict.conflictReason.replace('_', ' ')} • {conflict.entityType.replace('_', ' ')}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              className="text-sm border rounded px-2 py-1"
                              value={resolutions[conflict.entityId] || ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleResolutionChange(conflict.entityId, e.target.value as any)}
                            >
                              <option value="">Choose resolution...</option>
                              <option value="keep_local">Keep Local</option>
                              <option value="merge">Smart Merge</option>
                              <option value="keep_remote">Keep POS</option>
                            </select>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="detailed" className="flex-1 overflow-hidden">
              {selectedConflict ? (
                <ScrollArea className="h-[400px]">
                  <div className="p-4">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                        <span className="text-2xl">{getConflictIcon(selectedConflict.conflictReason)}</span>
                        {selectedConflict.localData.name}
                      </h3>
                      <Badge variant="secondary">
                        {selectedConflict.conflictReason.replace('_', ' ')}
                      </Badge>
                    </div>
                    {renderDataComparison(selectedConflict.localData, selectedConflict.remoteData, selectedConflict)}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  Select a conflict from the list to view details
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <Separator />

        <DialogFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            {Object.keys(resolutions).length} of {conflicts.length} conflicts have resolutions selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={resolving}>
              Cancel
            </Button>
            <Button 
              onClick={handleResolveAll} 
              disabled={resolving || Object.keys(resolutions).length === 0}
              className="min-w-[120px]"
            >
              {resolving ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Resolve All
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};