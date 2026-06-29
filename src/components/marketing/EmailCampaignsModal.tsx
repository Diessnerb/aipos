import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEmailCampaigns } from '@/hooks/useEmailCampaigns';
import { Mail, Users, Eye, MousePointer, Calendar, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

interface EmailCampaignsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmailCampaignsModal({ isOpen, onClose }: EmailCampaignsModalProps) {
  const { data: campaigns, isLoading } = useEmailCampaigns();
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-green-600" />
            Email Campaigns
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[600px] pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-24 bg-muted rounded-lg" />
                </div>
              ))}
            </div>
          ) : !campaigns || campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="h-12 w-12 text-green-600 mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No email campaigns yet</h3>
              <p className="text-muted-foreground mb-4">
                Create and send your first email campaign to see it here
              </p>
              <Button variant="outline">Create Campaign</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => {
                const metadata = campaign.metadata as any;
                const openRate = metadata?.open_rate || 0;
                const clickRate = metadata?.click_rate || 0;
                const recipients = metadata?.recipients || 0;

                return (
                  <Card
                    key={campaign.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedCampaign(campaign)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">
                              {metadata?.subject || campaign.content || 'Untitled Campaign'}
                            </h3>
                            {campaign.approval_status === 'published' && (
                              <Badge variant="default" className="bg-green-600">
                                Sent
                              </Badge>
                            )}
                            {campaign.approval_status === 'scheduled' && (
                              <Badge variant="secondary">Scheduled</Badge>
                            )}
                            {campaign.approval_status === 'draft' && (
                              <Badge variant="outline">Draft</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {campaign.posted_at
                                  ? formatDistanceToNow(new Date(campaign.posted_at), {
                                      addSuffix: true,
                                    })
                                  : 'Not sent'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              <span>{recipients.toLocaleString()} recipients</span>
                            </div>
                          </div>

                          {/* Performance Metrics */}
                          <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-1">
                              <Eye className="h-4 w-4 text-blue-600" />
                              <span className="font-medium">{openRate}%</span>
                              <span className="text-muted-foreground">Open Rate</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MousePointer className="h-4 w-4 text-purple-600" />
                              <span className="font-medium">{clickRate}%</span>
                              <span className="text-muted-foreground">Click Rate</span>
                            </div>
                          </div>
                        </div>

                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Campaign Detail Modal */}
        {selectedCampaign && (
          <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Campaign Preview</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Subject Line</h4>
                  <p className="text-sm text-muted-foreground">
                    {(selectedCampaign.metadata as any)?.subject || 'No subject'}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Content</h4>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedCampaign.content || 'No content'}
                    </p>
                  </div>
                </div>
                {selectedCampaign.image_urls && selectedCampaign.image_urls.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Featured Image</h4>
                    <img
                      src={selectedCampaign.image_urls[0]}
                      alt="Campaign"
                      className="w-full rounded-lg"
                    />
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
