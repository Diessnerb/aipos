
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ChevronDown, Copy, RefreshCw, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AiCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseContent: (content: string, title?: string) => void;
  campaignType: string;
  currentTitle?: string;
}

export const AiCampaignModal = ({ 
  isOpen, 
  onClose, 
  onUseContent, 
  campaignType,
  currentTitle 
}: AiCampaignModalProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    campaignAbout: '',
    toneOfVoice: '',
    preferredLength: campaignType === 'sms' ? 'short' : campaignType === 'social' ? 'medium' : 'long',
    callToAction: '',
    seasonalReference: '',
    audienceType: '',
    promotionLimitations: ''
  });

  const toneOptions = [
    { value: 'friendly', label: 'Friendly' },
    { value: 'informative', label: 'Informative' },
    { value: 'professional', label: 'Professional' },
    { value: 'playful', label: 'Playful' },
    { value: 'urgent', label: 'Urgent' }
  ];

  const lengthOptions = [
    { value: 'short', label: 'Short (SMS)', description: 'Up to 160 characters' },
    { value: 'medium', label: 'Medium (Social)', description: '1-2 sentences' },
    { value: 'long', label: 'Long (Email)', description: 'Multiple paragraphs' }
  ];

  const handleGenerate = async () => {
    if (!formData.campaignAbout.trim()) {
      toast({
        title: "Missing Information",
        description: "Please describe what this campaign is about.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-campaign', {
        body: {
          campaignAbout: formData.campaignAbout,
          toneOfVoice: formData.toneOfVoice || 'friendly',
          preferredLength: formData.preferredLength,
          callToAction: formData.callToAction,
          seasonalReference: formData.seasonalReference,
          audienceType: formData.audienceType,
          promotionLimitations: formData.promotionLimitations,
          campaignType
        }
      });

      if (error) throw error;

      setGeneratedContent(data.content);
    } catch (error) {
      console.error('Error generating campaign:', error);
      toast({
        title: "Generation Failed",
        description: "Unable to generate campaign content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyContent = async () => {
    if (generatedContent) {
      await navigator.clipboard.writeText(generatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Content Copied",
        description: "Campaign content copied to clipboard.",
      });
    }
  };

  const handleUseContent = () => {
    if (generatedContent) {
      // Generate a title from the first line of content if no title exists
      let suggestedTitle = currentTitle;
      if (!currentTitle && generatedContent) {
        const firstLine = generatedContent.split('\n')[0];
        suggestedTitle = firstLine.length > 50 
          ? firstLine.substring(0, 47) + '...' 
          : firstLine;
      }
      
      onUseContent(generatedContent, suggestedTitle);
      handleClose();
    }
  };

  const handleRegenerate = () => {
    setGeneratedContent('');
    handleGenerate();
  };

  const handleClose = () => {
    setGeneratedContent('');
    setFormData({
      campaignAbout: '',
      toneOfVoice: '',
      preferredLength: campaignType === 'sms' ? 'short' : campaignType === 'social' ? 'medium' : 'long',
      callToAction: '',
      seasonalReference: '',
      audienceType: '',
      promotionLimitations: ''
    });
    setShowAdvanced(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Campaign Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-about" className="text-sm font-medium">
                What is this campaign about? *
              </Label>
              <Textarea
                id="campaign-about"
                placeholder="E.g., Promoting our new lunch set. Free drink with every burger."
                value={formData.campaignAbout}
                onChange={(e) => setFormData(prev => ({ ...prev, campaignAbout: e.target.value }))}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tone of voice</Label>
                <Select
                  value={formData.toneOfVoice}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, toneOfVoice: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    {toneOptions.map((tone) => (
                      <SelectItem key={tone.value} value={tone.value}>
                        {tone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cta-text">Call to Action (optional)</Label>
                <Input
                  id="cta-text"
                  placeholder="e.g., Book now, View menu"
                  value={formData.callToAction}
                  onChange={(e) => setFormData(prev => ({ ...prev, callToAction: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Preferred length</Label>
              <RadioGroup
                value={formData.preferredLength}
                onValueChange={(value) => setFormData(prev => ({ ...prev, preferredLength: value }))}
                className="space-y-2"
              >
                {lengthOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-gray-500">{option.description}</span>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>

          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <span className="text-sm font-medium">Advanced Settings</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="seasonal">Seasonal reference</Label>
                  <Input
                    id="seasonal"
                    placeholder="e.g., Father's Day, Summer Deals"
                    value={formData.seasonalReference}
                    onChange={(e) => setFormData(prev => ({ ...prev, seasonalReference: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audience">Audience type</Label>
                  <Input
                    id="audience"
                    placeholder="e.g., Loyal customers, New signups, Everyone"
                    value={formData.audienceType}
                    onChange={(e) => setFormData(prev => ({ ...prev, audienceType: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="limitations">Promotion limitations</Label>
                  <Input
                    id="limitations"
                    placeholder="e.g., Dine-in only, Valid until Friday"
                    value={formData.promotionLimitations}
                    onChange={(e) => setFormData(prev => ({ ...prev, promotionLimitations: e.target.value }))}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {generatedContent && (
            <Card className="border-2 border-purple-200 bg-purple-50">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    AI Generated Content
                  </Badge>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyContent}
                      className="flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerate}
                      disabled={isGenerating}
                      className="flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                      Regenerate
                    </Button>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {generatedContent}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-600">
                    You can still edit this in the main content field.
                  </p>
                  <Button onClick={handleUseContent} className="bg-purple-600 hover:bg-purple-700">
                    Use This Content
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {!generatedContent && (
            <Button 
              onClick={handleGenerate}
              disabled={isGenerating || !formData.campaignAbout.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Campaign
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
