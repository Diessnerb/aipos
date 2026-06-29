import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X, RefreshCw, Building2, Mail, Phone, Globe, MessageCircle, MapPin, Clock } from 'lucide-react';

interface CompanyInfoBlockProps {
  // Logo and company info
  logo_url: string | null;
  company_name: string | null;
  
  // Contact info
  email: string | null;
  phone: string | null;
  website_url: string | null;
  support_contact: string | null;
  
  // Location info
  timezone: string | null;
  
  // Functions
  onSaveContactAndLocation: (data: {
    email: string;
    phone: string;
    website_url: string;
    support_contact: string;
    timezone: string;
  }) => void;
  onUploadLogo: (file: File) => Promise<void>;
  onRemoveLogo: () => void;
  onRefresh: () => void;
  loading?: boolean;
  uploading?: boolean;
  refreshing?: boolean;
}

const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' }
];

const CompanyInfoBlock = ({
  logo_url,
  company_name,
  email,
  phone,
  website_url,
  support_contact,
  timezone,
  onSaveContactAndLocation,
  onUploadLogo,
  onRemoveLogo,
  onRefresh,
  loading = false,
  uploading = false,
  refreshing = false
}: CompanyInfoBlockProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    email: email || '',
    phone: phone || '',
    website_url: website_url || '',
    support_contact: support_contact || '',
    timezone: timezone || ''
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    try {
      await onUploadLogo(file);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.timezone) {
      onSaveContactAndLocation(formData);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Company Info
          </CardTitle>
          <CardDescription>
            Manage your company information, contact details, and location settings
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Company Name & Logo Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Name - Read Only */}
          <div className="space-y-2">
            <Label>Company Name</Label>
            <div className="p-3 bg-gray-50 border rounded-md">
              <span className="text-gray-700">
                {company_name || 'Restaurant Admin'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Company name is automatically configured from your Supabase project settings.
            </p>
          </div>

          {/* Logo Management */}
          <div className="space-y-4">
            <Label>Company Logo</Label>
            
            {/* Current Logo Display */}
            {logo_url && (
              <div className="flex items-center space-x-4 p-4 border rounded-lg">
                <img 
                  src={logo_url} 
                  alt="Current Logo" 
                  className="w-16 h-16 object-contain rounded"
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Current logo</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRemoveLogo}
                >
                  <X className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              </div>
            )}

            {/* Upload New Logo */}
            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Logo'}
              </Button>
              <span className="text-sm text-gray-500">
                Max 2MB, PNG/JPG/GIF
              </span>
            </div>
          </div>
        </div>

        {/* Contact Information & Timezone Grid */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Business Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="contact@business.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Business Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Business Timezone
              </Label>
              <Select value={formData.timezone} onValueChange={(value) => handleChange('timezone', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website_url" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Website URL
              </Label>
              <Input
                id="website_url"
                type="url"
                value={formData.website_url}
                onChange={(e) => handleChange('website_url', e.target.value)}
                placeholder="https://www.business.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support_contact" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Support Contact
              </Label>
              <Input
                id="support_contact"
                value={formData.support_contact}
                onChange={(e) => handleChange('support_contact', e.target.value)}
                placeholder="support@business.com or +1 (555) 987-6543"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading || !formData.timezone}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CompanyInfoBlock;