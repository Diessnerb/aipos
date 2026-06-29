import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Upload, Image as ImageIcon, Loader2, Sparkles, Download, 
  Trash2, Search, Filter, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { useAssets, useUploadAsset, Asset } from '@/hooks/useMarketingData';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function AssetsLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  
  const { data: assets, isLoading } = useAssets(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const uploadAsset = useUploadAsset();

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }

      try {
        await uploadAsset.mutateAsync(file);
        toast.success(`${file.name} uploaded! Enhancement will begin shortly.`);
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  }, [uploadAsset]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    
    const dataTransfer = new DataTransfer();
    Array.from(files).forEach(file => dataTransfer.items.add(file));
    input.files = dataTransfer.files;
    
    input.dispatchEvent(new Event('change', { bubbles: true }));
    handleFileUpload({ target: input } as any);
  }, [handleFileUpload]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <Sparkles className="w-3 h-3 mr-1" />
            Enhanced
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Enhancing...
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Original
          </Badge>
        );
    }
  };

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage
      .from('marketing-assets')
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const filteredAssets = assets?.filter(asset => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        asset.file_name.toLowerCase().includes(query) ||
        asset.metadata?.title?.toLowerCase().includes(query) ||
        asset.metadata?.dish_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Assets</CardTitle>
          <CardDescription>
            Upload images to automatically enhance them with AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              Drag and drop images here, or click to browse
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Supports JPG, PNG, WebP (Max 50MB per file)
            </p>
            <Input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <Button asChild variant="outline">
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Choose Files
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by filename, title, or dish name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('completed')}
          >
            Enhanced
          </Button>
          <Button
            variant={statusFilter === 'processing' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('processing')}
          >
            Processing
          </Button>
        </div>
      </div>

      {/* Assets Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-square bg-muted" />
              <CardContent className="p-3">
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAssets && filteredAssets.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <Card
              key={asset.id}
              className="group hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedAsset(asset);
                if (asset.enhancement_status === 'completed' && asset.enhanced_file_path) {
                  setShowComparison(true);
                }
              }}
            >
              <div className="aspect-square relative overflow-hidden rounded-t-lg">
                <img
                  src={getImageUrl(asset.enhanced_file_path || asset.file_path)}
                  alt={asset.file_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute top-2 right-2">
                  {getStatusBadge(asset.enhancement_status)}
                </div>
              </div>
              <CardContent className="p-3">
                <p className="font-medium text-sm truncate">{asset.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {(asset.file_size / 1024).toFixed(0)} KB
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">No assets yet</p>
            <p className="text-sm text-muted-foreground">
              Upload your first image to get started
            </p>
          </CardContent>
        </Card>
      )}

      {/* Before/After Comparison Modal */}
      <Dialog open={showComparison} onOpenChange={setShowComparison}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Before & After Comparison</DialogTitle>
          </DialogHeader>
          {selectedAsset && selectedAsset.enhanced_file_path && (
            <div className="space-y-4">
              <div className="relative aspect-video overflow-hidden rounded-lg">
                <div
                  className="absolute inset-0 flex"
                  style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                >
                  <img
                    src={getImageUrl(selectedAsset.enhanced_file_path)}
                    alt="Enhanced"
                    className="w-full h-full object-cover"
                  />
                </div>
                <img
                  src={getImageUrl(selectedAsset.file_path)}
                  alt="Original"
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
                  style={{ left: `${sliderPosition}%` }}
                  onMouseDown={(e) => {
                    const startX = e.clientX;
                    const startPos = sliderPosition;
                    
                    const handleMouseMove = (e: MouseEvent) => {
                      const rect = e.currentTarget as HTMLDivElement;
                      const parent = rect.parentElement;
                      if (!parent) return;
                      
                      const deltaX = e.clientX - startX;
                      const deltaPercent = (deltaX / parent.offsetWidth) * 100;
                      const newPos = Math.max(0, Math.min(100, startPos + deltaPercent));
                      setSliderPosition(newPos);
                    };
                    
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                    <div className="w-0.5 h-4 bg-gray-400" />
                  </div>
                </div>
                <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                  Original
                </div>
                <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Enhanced
                </div>
              </div>
              
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setShowComparison(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    if (selectedAsset.enhanced_file_path) {
                      window.open(getImageUrl(selectedAsset.enhanced_file_path), '_blank');
                    }
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Enhanced
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
