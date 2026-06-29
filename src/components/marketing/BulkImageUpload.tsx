import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMenuItems } from '@/hooks/useMenuItems';

interface ImageUpload {
  file: File;
  preview: string;
  menuItemId?: string;
  menuItemName?: string;
}

interface BulkImageUploadProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BulkImageUpload({ isOpen, onClose }: BulkImageUploadProps) {
  const [uploads, setUploads] = useState<ImageUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const { menuItems } = useMenuItems();

  const handleFileSelection = (files: FileList) => {
    const newUploads: ImageUpload[] = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setUploads(prev => [...prev, ...newUploads]);
  };

  const removeUpload = (index: number) => {
    setUploads(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateUpload = (index: number, updates: Partial<ImageUpload>) => {
    setUploads(prev => prev.map((upload, i) => 
      i === index ? { ...upload, ...updates } : upload
    ));
  };

  const handleBulkUpload = async () => {
    if (uploads.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    
    try {
      // Get company context for proper scoping
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData?.company_id) throw new Error('No company context found');

      for (const upload of uploads) {
        try {
          // Upload to Supabase Storage with company scoping
          const fileExt = upload.file.name.split('.').pop();
          const fileName = `${Date.now()}-${upload.file.name}`;
          const filePath = `${userData.company_id}/menu-items/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('menu-images')
            .upload(filePath, upload.file);
          
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage
            .from('menu-images')
            .getPublicUrl(filePath);

          // If linked to menu item, update the menu item
          if (upload.menuItemId) {
            const { data: existingItem } = await supabase
              .from('menu_items')
              .select('image_urls')
              .eq('id', upload.menuItemId)
              .single();

            const currentUrls = existingItem?.image_urls || [];
            const updatedUrls = [...currentUrls, publicUrl];

            const { error: updateError } = await supabase
              .from('menu_items')
              .update({ 
                image_urls: updatedUrls
              })
              .eq('id', upload.menuItemId);

            if (updateError) throw updateError;
          }

          successCount++;
        } catch (error) {
          console.error('Error uploading file:', upload.file.name, error);
        }
      }

      toast({
        title: "Upload Complete",
        description: `Successfully uploaded ${successCount} of ${uploads.length} images.`,
      });

      if (successCount === uploads.length) {
        onClose();
        setUploads([]);
      }
    } catch (error) {
      console.error('Bulk upload error:', error);
      toast({
        title: "Upload Error",
        description: "An error occurred during bulk upload. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Image Upload</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Selection */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
              className="hidden"
              id="bulk-upload"
            />
            <label
              htmlFor="bulk-upload"
              className="flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 rounded-lg p-4 transition-colors"
            >
              <Upload className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Upload Menu Item Images</h3>
              <p className="text-sm text-muted-foreground text-center">
                Click to select multiple images or drag and drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, JPEG up to 10MB each
              </p>
            </label>
          </div>

          {/* Upload List */}
          {uploads.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Images to Upload ({uploads.length})</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {uploads.map((upload, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                    <img
                      src={upload.preview}
                      alt={`Upload ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border"
                    />
                    
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{upload.file.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUpload(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div>
                        <Label className="text-xs">Link to Menu Item (Optional)</Label>
                        <Select 
                          value={upload.menuItemId || ''} 
                          onValueChange={(value) => {
                            const item = menuItems?.find(item => item.id === value);
                            updateUpload(index, { 
                              menuItemId: value || undefined,
                              menuItemName: item?.name || undefined
                            });
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select menu item" />
                          </SelectTrigger>
                          <SelectContent>
                            {menuItems?.map(item => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkUpload} 
              disabled={uploads.length === 0 || isUploading}
              className="min-w-[120px]"
            >
              {isUploading ? 'Uploading...' : `Upload ${uploads.length} Images`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}