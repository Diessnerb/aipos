import React, { useState, useRef } from 'react';
// Layout is now handled by MainLayout - no need to import
import PermissionGuard from '@/components/PermissionGuard';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { DEFAULT_BRANDING_SETTINGS } from '@/utils/brandingDefaults';

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

const BrandingSettings = () => {
  const navigate = useNavigate();
  const { settings, loading, updateSettings, uploadLogo, refetch } = useCompanySettings();
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState(DEFAULT_BRANDING_SETTINGS);

  // Sync form data with settings when they load or change
  React.useEffect(() => {
    if (settings) {
      setFormData({
        primary_color: (settings.primary_color || DEFAULT_BRANDING_SETTINGS.primary_color) as string,
        secondary_color: (settings.secondary_color || DEFAULT_BRANDING_SETTINGS.secondary_color) as string,
        font_style: (settings.font_style || DEFAULT_BRANDING_SETTINGS.font_style) as string,
        button_style: (settings.button_style || DEFAULT_BRANDING_SETTINGS.button_style) as string,
        show_allergen_disclaimer: (settings.show_allergen_disclaimer ?? DEFAULT_BRANDING_SETTINGS.show_allergen_disclaimer) as boolean
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings(formData);
      
      // Apply theme changes instantly without waiting for refetch
      applyBrandingInstantly(formData);
      
      // Fire custom event for logo updates
      window.dispatchEvent(new CustomEvent('company-logo-updated'));
    } finally {
      setSaving(false);
    }
  };

  // Helper function to apply branding instantly
  const applyBrandingInstantly = (brandingData: typeof formData) => {
    const root = document.documentElement;
    
    // Convert hex to HSL for CSS variables
    const hexToHsl = (hex: string): string => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }

      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };

    // Apply colors
    if (brandingData.primary_color) {
      root.style.setProperty('--brand-primary', hexToHsl(brandingData.primary_color));
    }
    if (brandingData.secondary_color) {
      root.style.setProperty('--brand-secondary', hexToHsl(brandingData.secondary_color));
    }

    // Apply font
    if (brandingData.font_style) {
      const fontFamilyMap: { [key: string]: string } = {
        'inter': 'Inter, sans-serif',
        'roboto': 'Roboto, sans-serif',
        'open-sans': 'Open Sans, sans-serif',
        'lato': 'Lato, sans-serif',
        'montserrat': 'Montserrat, sans-serif'
      };
      
      const fontFamily = fontFamilyMap[brandingData.font_style];
      if (fontFamily) {
        root.style.setProperty('--brand-font-family', fontFamily);
      }
    }

    // Fire custom event for theme updates
    window.dispatchEvent(new CustomEvent('branding-theme-updated', {
      detail: brandingData
    }));
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setLogoUploading(true);
    try {
      await uploadLogo(file);
      // Force immediate refetch to update UI instantly
      await refetch();
    } finally {
      setLogoUploading(false);
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    setSaving(true);
    try {
      await updateSettings({ logo_url: null });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PermissionGuard route="/settings/branding" requiredPermission="edit">
      <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Settings
            </Button>
          </div>

          <PageHeader 
            title="Branding Customisation" 
            subtitle="Customise your brand colours, fonts, and appearance" 
          />

          <div className="max-w-2xl space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Logo Upload */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground">Company Logo</h4>
              <div className="space-y-4">
                {settings?.logo_url && (
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    <img 
                      src={settings.logo_url} 
                      alt="Company Logo" 
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Current Logo</p>
                      <p className="text-xs text-muted-foreground">This logo appears in your sidebar</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      disabled={saving}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="logo-upload">Upload Logo Here</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      ref={fileInputRef}
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={logoUploading}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={logoUploading}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {logoUploading ? 'Uploading...' : settings?.logo_url ? 'Replace Logo' : 'Upload Logo'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload a company logo to display in your sidebar. Max 5MB, image files only.
                  </p>
                </div>
              </div>
            </div>

            {/* Color Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground">Brand Colours</h4>
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
                      placeholder={DEFAULT_BRANDING_SETTINGS.primary_color}
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
                      placeholder={DEFAULT_BRANDING_SETTINGS.secondary_color}
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

            <Button type="submit" disabled={saving || loading} className="w-full">
              {saving ? 'Saving...' : 'Save Branding Settings'}
            </Button>
          </form>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default BrandingSettings;