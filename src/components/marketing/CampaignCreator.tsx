import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Smartphone, Hash, Instagram, Facebook, Twitter, Sparkles, Users, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AiCampaignModal } from './AiCampaignModal';

interface CampaignCreatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CampaignCreator = ({ isOpen, onClose }: CampaignCreatorProps) => {
  const [campaignType, setCampaignType] = useState<string>('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [channel, setChannel] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  const campaignTypes = [
    { value: 'email', label: 'Email Campaign', icon: Mail, color: 'bg-blue-100 text-blue-800' },
    { value: 'sms', label: 'SMS Campaign', icon: Smartphone, color: 'bg-green-100 text-green-800' },
    { value: 'social', label: 'Social Media', icon: Hash, color: 'bg-purple-100 text-purple-800' }
  ];

  const socialChannels = [
    { value: 'instagram', label: 'Instagram', icon: Instagram },
    { value: 'facebook', label: 'Facebook', icon: Facebook },
    { value: 'twitter', label: 'Twitter', icon: Twitter }
  ];

  const customerSegments = [
    { id: 'all', name: 'All Customers', count: 2849 },
    { id: 'vip', name: 'VIP Customers', count: 145 },
    { id: 'new', name: 'New Customers', count: 324 },
    { id: 'regular', name: 'Regular Customers', count: 1891 },
    { id: 'inactive', name: 'Inactive Customers', count: 489 }
  ];

  const handleAiGenerate = () => {
    if (!campaignType) {
      toast({
        title: "Select Campaign Type",
        description: "Please select a campaign type before using AI generation.",
        variant: "destructive"
      });
      return;
    }
    setShowAiModal(true);
  };

  const handleUseAiContent = (aiContent: string, suggestedTitle?: string) => {
    setContent(aiContent);
    if (suggestedTitle && !title) {
      setTitle(suggestedTitle);
    }
    setShowAiModal(false);
    toast({
      title: "AI Content Applied",
      description: "Generated content has been added to your campaign.",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !campaignType || !content) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const campaignData = {
        title,
        type: campaignType,
        channel: campaignType === 'social' ? channel : campaignType,
        content,
        subject_line: subjectLine || null,
        cta_text: ctaText || null,
        cta_url: ctaUrl || null,
        audience_filter: { segments: selectedSegments },
        scheduled_at: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        created_by: 'current_user', // Replace with actual user
        target_count: selectedSegments.includes('all') ? 2849 : 
                     selectedSegments.reduce((sum, segmentId) => {
                       const segment = customerSegments.find(s => s.id === segmentId);
                       return sum + (segment?.count || 0);
                     }, 0)
      };

      const { data, error } = await supabase
        .from('marketing_campaigns')
        .insert([campaignData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Campaign Created",
        description: `"${title}" has been created successfully.`,
      });

      onClose();
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: "Failed to create campaign. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Create New Campaign</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campaign Type Selection */}
            <div className="space-y-3">
              <Label>Campaign Type *</Label>
              <div className="grid grid-cols-3 gap-3">
                {campaignTypes.map((type) => (
                  <Card 
                    key={type.value}
                    className={`cursor-pointer transition-all ${
                      campaignType === type.value 
                        ? 'ring-2 ring-blue-500 bg-blue-50' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setCampaignType(type.value)}
                  >
                    <CardContent className="p-4 text-center">
                      <type.icon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                      <p className="font-medium">{type.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Social Media Channel Selection */}
            {campaignType === 'social' && (
              <div className="space-y-3">
                <Label>Social Media Platform *</Label>
                <div className="grid grid-cols-3 gap-3">
                  {socialChannels.map((socialChannel) => (
                    <Card 
                      key={socialChannel.value}
                      className={`cursor-pointer transition-all ${
                        channel === socialChannel.value 
                          ? 'ring-2 ring-blue-500 bg-blue-50' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setChannel(socialChannel.value)}
                    >
                      <CardContent className="p-4 text-center">
                        <socialChannel.icon className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                        <p className="text-sm font-medium">{socialChannel.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Tabs defaultValue="content" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="audience">Audience</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="title">Campaign Title *</Label>
                  <Input
                    id="title"
                    placeholder="Enter campaign title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                {campaignType === 'email' && (
                  <div className="space-y-3">
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      placeholder="Enter email subject line"
                      value={subjectLine}
                      onChange={(e) => setSubjectLine(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="content">Content *</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={handleAiGenerate}
                      className="flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      AI Generate
                    </Button>
                  </div>
                  <Textarea
                    id="content"
                    placeholder={`Enter your ${campaignType} content here...`}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label htmlFor="cta-text">Call to Action Text</Label>
                    <Input
                      id="cta-text"
                      placeholder="e.g. Shop Now, Learn More"
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="cta-url">Call to Action URL</Label>
                    <Input
                      id="cta-url"
                      placeholder="https://example.com"
                      value={ctaUrl}
                      onChange={(e) => setCtaUrl(e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="audience" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <Label>Target Audience</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {customerSegments.map((segment) => (
                      <Card 
                        key={segment.id}
                        className={`cursor-pointer transition-all ${
                          selectedSegments.includes(segment.id)
                            ? 'ring-2 ring-blue-500 bg-blue-50' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          if (selectedSegments.includes(segment.id)) {
                            setSelectedSegments(selectedSegments.filter(id => id !== segment.id));
                          } else {
                            setSelectedSegments([...selectedSegments, segment.id]);
                          }
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{segment.name}</span>
                            <Badge variant="secondary">{segment.count}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    <Label htmlFor="schedule">Schedule Campaign</Label>
                  </div>
                  <Input
                    id="schedule"
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                  <p className="text-sm text-gray-600">
                    Leave empty to save as draft
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Campaign'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* AI Campaign Generation Modal */}
      <AiCampaignModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onUseContent={handleUseAiContent}
        campaignType={campaignType}
        currentTitle={title}
      />
    </>
  );
};
