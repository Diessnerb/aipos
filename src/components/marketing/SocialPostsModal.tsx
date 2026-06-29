import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSocialMediaPosts } from '@/hooks/useMarketingAnalytics';
import { Instagram, Facebook, Heart, MessageCircle, Share2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

interface SocialPostsModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: 'instagram' | 'facebook';
}

export function SocialPostsModal({ isOpen, onClose, platform }: SocialPostsModalProps) {
  const { data: posts, isLoading } = useSocialMediaPosts(platform);
  
  const platformConfig = {
    instagram: {
      icon: Instagram,
      color: 'text-pink-600',
      bgColor: 'bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500',
      name: 'Instagram',
    },
    facebook: {
      icon: Facebook,
      color: 'text-blue-600',
      bgColor: 'bg-blue-600',
      name: 'Facebook',
    },
  };

  const config = platformConfig[platform];
  const PlatformIcon = config.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlatformIcon className={`h-5 w-5 ${config.color}`} />
            {config.name} Posts
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[600px] pr-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-muted rounded-lg mb-2" />
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : !posts || posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <PlatformIcon className={`h-12 w-12 ${config.color} mb-4 opacity-50`} />
              <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
              <p className="text-muted-foreground mb-4">
                Sync your {config.name} account to see your posts here
              </p>
              <Button variant="outline">Sync Data</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {posts.map((post) => (
                <div key={post.id} className="group relative">
                  {/* Post Image */}
                  <div className="relative aspect-square rounded-lg overflow-hidden mb-3 bg-muted">
                    {post.image_urls && post.image_urls.length > 0 ? (
                      <img
                        src={post.image_urls[0]}
                        alt={post.content || 'Post'}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className={`w-full h-full ${config.bgColor} flex items-center justify-center`}>
                        <PlatformIcon className="h-12 w-12 text-white opacity-50" />
                      </div>
                    )}
                    
                    {/* Platform Badge */}
                    <div className="absolute top-2 right-2">
                      <Badge className={config.bgColor}>
                        <PlatformIcon className="h-3 w-3 text-white" />
                      </Badge>
                    </div>

                    {/* Hover Overlay with Engagement */}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white">
                      <div className="flex items-center gap-1">
                        <Heart className="h-5 w-5" />
                        <span className="font-semibold">{post.likes_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-5 w-5" />
                        <span className="font-semibold">{post.comments_count || 0}</span>
                      </div>
                      {post.shares_count > 0 && (
                        <div className="flex items-center gap-1">
                          <Share2 className="h-5 w-5" />
                          <span className="font-semibold">{post.shares_count}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Caption */}
                  <p className="text-sm text-foreground line-clamp-2 mb-2">
                    {post.content || 'No caption'}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {post.posted_at 
                          ? formatDistanceToNow(new Date(post.posted_at), { addSuffix: true })
                          : 'Not posted'}
                      </span>
                    </div>
                    {post.impressions_count > 0 && (
                      <span>{post.impressions_count.toLocaleString()} impressions</span>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
