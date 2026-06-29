
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Palette, Type, Square, AlertTriangle } from 'lucide-react';

interface BrandingBlockProps {
  primary_color: string | null;
  secondary_color: string | null;
  font_style: string | null;
  button_style: string | null;
  show_allergen_disclaimer: boolean | null;
  onSave: (data: {
    primary_color: string;
    secondary_color: string;
    font_style: string;
    button_style: string;
    show_allergen_disclaimer: boolean;
  }) => void;
  loading?: boolean;
}

const fontOptions = [
  { value: 'inter', label: 'Inter (Modern & Clean)' },
  { value: 'roboto', label: 'Roboto (Professional)' },
  { value: 'open-sans', label: 'Open Sans (Friendly)' },
  { value: 'lato', label: 'Lato (Elegant)' },
  { value: 'montserrat', label: 'Montserrat (Bold)' }
];

const buttonStyleOptions = [
  { value: 'rounded', label: 'Rounded (Modern)' },
  { value: 'sharp', label: 'Sharp (Professional)' },
  { value: 'pill', label: 'Pill (Friendly)' }
];

const BrandingBlock = ({ 
  primary_color,
  secondary_color,
  font_style,
  button_style,
  show_allergen_disclaimer,
  onSave,
  loading = false 
}: BrandingBlockProps) => {
  const [formData, setFormData] = useState({
    primary_color: primary_color || '#000000',
    secondary_color: secondary_color || '#666666',
    font_style: font_style || 'inter',
    button_style: button_style || 'rounded',
    show_allergen_disclaimer: show_allergen_disclaimer || false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Branding Customisation
        </CardTitle>
        <CardDescription>
          Customise your brand colours, typography, and visual elements
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Color Settings */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Brand Colours
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Colour</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    type="text"
                    value={formData.primary_color}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    placeholder="#000000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondary_color">Secondary Colour</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => handleChange('secondary_color', e.target.value)}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    type="text"
                    value={formData.secondary_color}
                    onChange={(e) => handleChange('secondary_color', e.target.value)}
                    placeholder="#666666"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Typography Settings */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Type className="w-4 h-4" />
              Typography & Style
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="font_style">Font Family</Label>
                <Select value={formData.font_style} onValueChange={(value) => handleChange('font_style', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select font style" />
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
                <Select value={formData.button_style} onValueChange={(value) => handleChange('button_style', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select button style" />
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

          {/* Additional Settings */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Square className="w-4 h-4" />
              Display Options
            </h4>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="allergen_disclaimer" className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Show Allergen Disclaimer
                </Label>
                <p className="text-sm text-gray-500">
                  Display allergen information disclaimer on menu items
                </p>
              </div>
              <Switch
                id="allergen_disclaimer"
                checked={formData.show_allergen_disclaimer}
                onCheckedChange={(checked) => handleChange('show_allergen_disclaimer', checked)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default BrandingBlock;
