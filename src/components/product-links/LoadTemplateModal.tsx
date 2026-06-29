import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { LinkTemplate } from '@/types/linkTemplates';
import { Trash2, Download } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LoadTemplateModalProps {
  open: boolean;
  onClose: () => void;
  templates: LinkTemplate[];
  onLoad: (template: LinkTemplate) => void;
  onDelete: (templateId: string) => void;
}

export const LoadTemplateModal: React.FC<LoadTemplateModalProps> = ({
  open,
  onClose,
  templates,
  onLoad,
  onDelete,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<LinkTemplate | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const handleTemplateSelect = (template: LinkTemplate) => {
    setSelectedTemplate(template);
    setShowConfirmDialog(true);
  };

  const handleConfirmLoad = () => {
    if (selectedTemplate) {
      onLoad(selectedTemplate);
      setShowConfirmDialog(false);
      setSelectedTemplate(null);
      onClose();
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation();
    setDeleteTemplateId(templateId);
  };

  const handleConfirmDelete = async () => {
    if (deleteTemplateId) {
      await onDelete(deleteTemplateId);
      setDeleteTemplateId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Template</DialogTitle>
            <DialogDescription>
              Select a template to load at the current level. Options will be added to your current configuration.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px] pr-4">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No templates saved yet. Create one by configuring product links and clicking "Save as Template".
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer group"
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{template.template_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {template.link_structure_json.length} options
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteClick(e, template.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load Template</AlertDialogTitle>
            <AlertDialogDescription>
              This will add {selectedTemplate?.link_structure_json.length} options to the current level. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedTemplate(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLoad}>Load Options</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
