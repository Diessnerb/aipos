import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload, Palette, Type, FileText, Sparkles } from 'lucide-react';
import { useBrandKit, useUpdateBrandKit } from '@/hooks/useMarketingData';
import { toast } from 'sonner';

export function BrandKit() {
  const { data: brandKit, isLoading } = useBrandKit();
  const updateBrandKit = useUpdateBrandKit();
  
  const [formData, setFormData] = useState({
    primary_color: '#F97316',
    secondary_color: '#8B5CF6',
    accent_color: '#06B6D4',
    background_color: '#FFFFFF',
    tone_of_voice: 'warm' as 'warm' | 'premium' | 'fun' | 'professional' | 'custom',
    custom_tone_description: '',
    primary_font: 'Inter',
    secondary_font: 'Playfair Display',
  });

  useEffect(() => {
    if (brandKit) {
      setFormData({
        primary_color: brandKit.primary_color || '#F97316',
        secondary_color: brandKit.secondary_color || '#8B5CF6',
        accent_color: brandKit.accent_color || '#06B6D4',
        background_color: brandKit.background_color || '#FFFFFF',
        tone_of_voice: brandKit.tone_of_voice,
        custom_tone_description: brandKit.custom_tone_description || '',
        primary_font: brandKit.primary_font || 'Inter',
        secondary_font: brandKit.secondary_font || 'Playfair Display',
      });
    }
  }, [brandKit]);

  const handleSave = async () => {
    try {
      await updateBrandKit.mutateAsync(formData);
      toast.success('Brand Kit saved! AI will now use these settings for all content generation.');
    } catch (error) {
      toast.error('Failed to save Brand Kit');
    }
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

  const toneOptions = [
    {
      value: 'warm',
      emoji: '🔥',
      label: 'Warm & Welcoming',
      description: 'Friendly, inviting, comforting language',
    },
    {
      value: 'premium',
      emoji: '💎',
      label: 'Premium & Sophisticated',
      description: 'Refined, exclusive, elegant language',
    },
    {
      value: 'fun',
      emoji: '🎉',
      label: 'Fun & Playful',
      description: 'Energetic, lighthearted, casual language',
    },
    {
      value: 'professional',
      emoji: '👔',
      label: 'Professional & Trustworthy',
      description: 'Polished, reliable, expert language',
    },
    {
      value: 'custom',
      emoji: '✏️',
      label: 'Custom',
      description: 'Define your own unique brand voice',
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Brand Kit
          </CardTitle>
          <CardDescription>
            Configure your brand identity to ensure consistent AI-generated content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Section */}
          <div>
            <Label className="text-base font-semibold flex items-center gap-2 mb-3">
              <Upload className="w-4 h-4" />
              Logo
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-2 block">Primary Logo</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG/SVG, 500x500px min</p>
                </div>
              </div>
              <div>
                <Label className="text-sm mb-2 block">Secondary Logo (Optional)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">For dark backgrounds</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG/SVG, 500x500px min</p>
                </div>
              </div>
            </div>
          </div>

          {/* Color Palette */}
          <div>
            <Label className="text-base font-semibold flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4" />
              Color Palette
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="primary-color" className="text-sm mb-2 block">Primary</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary-color"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    placeholder="#F97316"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="secondary-color" className="text-sm mb-2 block">Secondary</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary-color"
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    placeholder="#8B5CF6"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="accent-color" className="text-sm mb-2 block">Accent</Label>
                <div className="flex gap-2">
                  <Input
                    id="accent-color"
                    type="color"
                    value={formData.accent_color}
                    onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.accent_color}
                    onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                    placeholder="#06B6D4"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="background-color" className="text-sm mb-2 block">Background</Label>
                <div className="flex gap-2">
                  <Input
                    id="background-color"
                    type="color"
                    value={formData.background_color}
                    onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.background_color}
                    onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                    placeholder="#FFFFFF"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tone of Voice */}
          <div>
            <Label className="text-base font-semibold flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4" />
              Tone of Voice
            </Label>
            <RadioGroup
              value={formData.tone_of_voice}
              onValueChange={(value: any) => setFormData({ ...formData, tone_of_voice: value })}
              className="space-y-3"
            >
              {toneOptions.map((option) => (
                <div key={option.value} className="flex items-start space-x-3">
                  <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                  <Label htmlFor={option.value} className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{option.emoji}</span>
                      <span className="font-medium">{option.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            
            {formData.tone_of_voice === 'custom' && (
              <Textarea
                value={formData.custom_tone_description}
                onChange={(e) => setFormData({ ...formData, custom_tone_description: e.target.value })}
                placeholder="Describe your brand voice... (e.g., 'Witty and approachable, with a hint of sophistication. We use food puns sparingly and focus on storytelling.')"
                className="mt-3"
                rows={4}
                maxLength={500}
              />
            )}
          </div>

          {/* Fonts */}
          <div>
            <Label className="text-base font-semibold flex items-center gap-2 mb-3">
              <Type className="w-4 h-4" />
              Typography
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primary-font" className="text-sm mb-2 block">Primary Font</Label>
                <Input
                  id="primary-font"
                  value={formData.primary_font}
                  onChange={(e) => setFormData({ ...formData, primary_font: e.target.value })}
                  placeholder="Inter"
                />
              </div>
              <div>
                <Label htmlFor="secondary-font" className="text-sm mb-2 block">Secondary Font</Label>
                <Input
                  id="secondary-font"
                  value={formData.secondary_font}
                  onChange={(e) => setFormData({ ...formData, secondary_font: e.target.value })}
                  placeholder="Playfair Display"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={updateBrandKit.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {updateBrandKit.isPending ? 'Saving...' : 'Save Brand Kit'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
