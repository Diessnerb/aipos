import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSMSCampaigns } from '@/hooks/useSMSCampaigns';
import { MessageSquare, Users, CheckCircle, Reply, Calendar, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

interface SMSCampaignsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SMSCampaignsModal({ isOpen, onClose }: SMSCampaignsModalProps) {
  const { data: campaigns, isLoading } = useSMSCampaigns();
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-red-600" />
            SMS Campaigns
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
              <MessageSquare className="h-12 w-12 text-red-600 mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No SMS campaigns yet</h3>
              <p className="text-muted-foreground mb-4">
                Create and send your first SMS campaign to see it here
              </p>
              <Button variant="outline">Create Campaign</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => {
                const metadata = campaign.metadata as any;
                const deliveryRate = metadata?.delivery_rate || 0;
                const replyRate = metadata?.reply_rate || 0;
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
                              {metadata?.name || campaign.content?.substring(0, 50) || 'Untitled Campaign'}
                            </h3>
                            {campaign.approval_status === 'published' && (
                              <Badge variant="default" className="bg-red-600">
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
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="font-medium">{deliveryRate}%</span>
                              <span className="text-muted-foreground">Delivered</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Reply className="h-4 w-4 text-blue-600" />
                              <span className="font-medium">{replyRate}%</span>
                              <span className="text-muted-foreground">Reply Rate</span>
                            </div>
                          </div>

                          {/* Preview of message */}
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {campaign.content || 'No message content'}
                          </p>
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
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>SMS Campaign Preview</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Campaign Name</h4>
                  <p className="text-sm text-muted-foreground">
                    {(selectedCampaign.metadata as any)?.name || 'Unnamed Campaign'}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Message</h4>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedCampaign.content || 'No message'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {selectedCampaign.content?.length || 0} characters
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Delivery Stats</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">
                        {(selectedCampaign.metadata as any)?.recipients || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Recipients</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {(selectedCampaign.metadata as any)?.delivery_rate || 0}%
                      </p>
                      <p className="text-sm text-muted-foreground">Delivered</p>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
