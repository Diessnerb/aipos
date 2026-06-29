import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle, Edit2, SkipForward, Trash2, Instagram, 
  Facebook, Calendar, TrendingUp, Image as ImageIcon
} from 'lucide-react';
import { usePendingApprovals, useApprovePost, useRejectPost } from '@/hooks/useMarketingData';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function ApprovalQueue() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editedCaption, setEditedCaption] = useState('');
  
  const { data: approvals, isLoading } = usePendingApprovals(
    selectedPlatform !== 'all' ? selectedPlatform : undefined
  );
  const approvePost = useApprovePost();
  const rejectPost = useRejectPost();

  const handleApprove = async (postId: string) => {
    try {
      await approvePost.mutateAsync(postId);
      toast.success('Post approved! It will be published at the scheduled time.');
    } catch (error) {
      toast.error('Failed to approve post');
    }
  };

  const handleReject = async (postId: string) => {
    try {
      await rejectPost.mutateAsync(postId);
      toast.success('Post rejected');
    } catch (error) {
      toast.error('Failed to reject post');
    }
  };

  const handleEdit = (post: any) => {
    setEditingPost(post);
    setEditedCaption(post.content || '');
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    
    try {
      const { error } = await supabase
        .from('social_media_posts')
        .update({ content: editedCaption })
        .eq('id', editingPost.id);
      
      if (error) throw error;
      
      toast.success('Post updated');
      setEditingPost(null);
    } catch (error) {
      toast.error('Failed to update post');
    }
  };

  const getImageUrl = (urls?: string[]) => {
    if (!urls || urls.length === 0) return null;
    const path = urls[0];
    const { data } = supabase.storage
      .from('marketing-assets')
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const getPlatformIcon = (platform: string) => {
    return platform === 'instagram' ? (
      <Instagram className="w-4 h-4" />
    ) : (
      <Facebook className="w-4 h-4" />
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardHeader className="h-24 bg-muted" />
          <CardContent className="h-64 bg-muted/50" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Awaiting Your Approval</CardTitle>
              <CardDescription>
                Review AI-generated posts before they go live
              </CardDescription>
            </div>
            {approvals && approvals.length > 0 && (
              <Button
                onClick={() => {
                  approvals.forEach((post) => handleApprove(post.id));
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve All ({approvals.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <TabsList className="mb-6">
              <TabsTrigger value="all">
                All ({approvals?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="instagram">
                <Instagram className="w-4 h-4 mr-2" />
                Instagram
              </TabsTrigger>
              <TabsTrigger value="facebook">
                <Facebook className="w-4 h-4 mr-2" />
                Facebook
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedPlatform} className="space-y-4">
              {approvals && approvals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {approvals.map((post) => {
                    const imageUrl = getImageUrl(post.image_urls);
                    
                    return (
                      <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        {imageUrl && (
                          <div className="aspect-square relative">
                            <img
                              src={imageUrl}
                              alt="Post preview"
                              className="w-full h-full object-cover"
                            />
                            <Badge
                              className="absolute top-2 right-2"
                              variant={post.platform === 'instagram' ? 'default' : 'secondary'}
                            >
                              {getPlatformIcon(post.platform)}
                              <span className="ml-1 capitalize">{post.platform}</span>
                            </Badge>
                          </div>
                        )}
                        <CardContent className="p-4 space-y-3">
                          <div>
                            <p className="text-sm line-clamp-3">{post.content}</p>
                          </div>
                          
                          {post.scheduled_at && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {new Date(post.scheduled_at).toLocaleString()}
                            </div>
                          )}
                          
                          {post.estimated_reach && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <TrendingUp className="w-3 h-3" />
                              Est. reach: {post.estimated_reach}
                            </div>
                          )}
                          
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(post.id)}
                              disabled={approvePost.isPending}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(post)}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReject(post.id)}
                              disabled={rejectPost.isPending}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2">No posts awaiting approval</p>
                    <p className="text-sm text-muted-foreground">
                      Upload images to automatically generate social posts
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={!!editingPost} onOpenChange={() => setEditingPost(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingPost && getImageUrl(editingPost.image_urls) && (
              <img
                src={getImageUrl(editingPost.image_urls)!}
                alt="Post preview"
                className="w-full aspect-square object-cover rounded-lg"
              />
            )}
            <Textarea
              value={editedCaption}
              onChange={(e) => setEditedCaption(e.target.value)}
              rows={6}
              placeholder="Edit caption..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingPost(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} className="bg-purple-600 hover:bg-purple-700">
                Save & Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
