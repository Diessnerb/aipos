import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import { PermissionTemplate } from '@/hooks/usePermissionTemplates';

interface LoadTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (templateId: string) => Promise<boolean>;
  onDelete: (templateId: string) => Promise<boolean>;
  templates: PermissionTemplate[];
  onFetchTemplates: () => void;
}

export const LoadTemplateModal: React.FC<LoadTemplateModalProps> = ({
  isOpen,
  onClose,
  onLoad,
  onDelete,
  templates,
  onFetchTemplates
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      onFetchTemplates();
      setSelectedTemplateId('');
    }
  }, [isOpen, onFetchTemplates]);

  const handleLoad = async () => {
    if (!selectedTemplateId) return;
    
    setIsLoading(true);
    const success = await onLoad(selectedTemplateId);
    setIsLoading(false);
    
    if (success) {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplateId) return;
    
    setIsDeleting(true);
    const success = await onDelete(selectedTemplateId);
    setIsDeleting(false);
    
    if (success) {
      setSelectedTemplateId('');
      onFetchTemplates();
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Load Permission Template</DialogTitle>
          <DialogDescription>
            Select a saved template to apply to your current permission configuration.
            This will replace all current permissions.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="template-select" className="text-right">
              Template
            </Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.template_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedTemplate && (
            <div className="grid grid-cols-4 items-center gap-4 text-sm text-muted-foreground">
              <div className="text-right">Created:</div>
              <div className="col-span-3">
                {new Date(selectedTemplate.created_at).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-between">
          <div>
            {selectedTemplateId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleLoad}
              disabled={!selectedTemplateId || isLoading}
            >
              {isLoading ? 'Loading...' : 'Load Template'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};