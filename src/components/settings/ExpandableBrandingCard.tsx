import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Palette } from 'lucide-react';
import ExpandableSettingsCard from './ExpandableSettingsCard';

interface ExpandableBrandingCardProps {
  primary_color?: string | null;
  secondary_color?: string | null;
  font_style?: string | null;
  button_style?: string | null;
  show_allergen_disclaimer?: boolean | null;
  onSave: (data: {
    primary_color: string;
    secondary_color: string;
    font_style: string;
    button_style: string;
    show_allergen_disclaimer: boolean;
  }) => Promise<void>;
  loading?: boolean;
}

const fontOptions = [
  { value: 'inter', label: 'Inter' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'open-sans', label: 'Open Sans' },
  { value: 'lato', label: 'Lato' },
  { value: 'montserrat', label: 'Montserrat' },
];

const buttonStyleOptions = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'square', label: 'Square' },
  { value: 'pill', label: 'Pill' },
];

const ExpandableBrandingCard = ({
  primary_color,
  secondary_color,
  font_style,
  button_style,
  show_allergen_disclaimer,
  onSave,
  loading = false
}: ExpandableBrandingCardProps) => {
  const [formData, setFormData] = useState({
    primary_color: primary_color || '#3B82F6',
    secondary_color: secondary_color || '#10B981',
    font_style: font_style || 'inter',
    button_style: button_style || 'rounded',
    show_allergen_disclaimer: show_allergen_disclaimer ?? true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <ExpandableSettingsCard
      title="Branding Customisation"
      description="Customise your brand colours, fonts, and display options"
      icon={<Palette className="w-5 h-5 text-primary" />}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Color Settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-foreground">Colour Settings</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Primary Colour</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="primary_color"
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  value={formData.primary_color}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary_color">Secondary Colour</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="secondary_color"
                  type="color"
                  value={formData.secondary_color}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  value={formData.secondary_color}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  placeholder="#10B981"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Typography Settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-foreground">Typography Settings</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="font_style">Font Family</Label>
              <Select
                value={formData.font_style}
                onValueChange={(value) => handleChange('font_style', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fontOptions.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="button_style">Button Style</Label>
              <Select
                value={formData.button_style}
                onValueChange={(value) => handleChange('button_style', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {buttonStyleOptions.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Display Options */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-foreground">Display Options</h4>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show_allergen_disclaimer">Show Allergen Disclaimer</Label>
              <p className="text-sm text-muted-foreground">
                Display allergen information disclaimers on menu items
              </p>
            </div>
            <Switch
              id="show_allergen_disclaimer"
              checked={formData.show_allergen_disclaimer}
              onCheckedChange={(checked) => handleChange('show_allergen_disclaimer', checked)}
            />
          </div>
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Saving...' : 'Save Branding Settings'}
        </Button>
      </form>
    </ExpandableSettingsCard>
  );
};

export default ExpandableBrandingCard;