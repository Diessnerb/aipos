import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail, Phone, Globe, MessageCircle, MapPin, Clock, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useCompanyLocation } from '@/hooks/useCompanyLocation';
import { useToast } from '@/hooks/use-toast';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (GMT+0)' },
  { value: 'Europe/London', label: 'London (GMT+0/+1)' },
  { value: 'Europe/Paris', label: 'Paris (GMT+1/+2)' },
  { value: 'Europe/Berlin', label: 'Berlin (GMT+1/+2)' },
  { value: 'Europe/Rome', label: 'Rome (GMT+1/+2)' },
  { value: 'Europe/Madrid', label: 'Madrid (GMT+1/+2)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (GMT+1/+2)' },
  { value: 'Europe/Brussels', label: 'Brussels (GMT+1/+2)' },
  { value: 'Europe/Vienna', label: 'Vienna (GMT+1/+2)' },
  { value: 'Europe/Prague', label: 'Prague (GMT+1/+2)' },
  { value: 'Europe/Warsaw', label: 'Warsaw (GMT+1/+2)' },
  { value: 'Europe/Stockholm', label: 'Stockholm (GMT+1/+2)' },
  { value: 'Europe/Oslo', label: 'Oslo (GMT+1/+2)' },
  { value: 'Europe/Copenhagen', label: 'Copenhagen (GMT+1/+2)' },
  { value: 'Europe/Helsinki', label: 'Helsinki (GMT+2/+3)' },
  { value: 'Europe/Athens', label: 'Athens (GMT+2/+3)' },
  { value: 'Europe/Istanbul', label: 'Istanbul (GMT+3)' },
  { value: 'Europe/Moscow', label: 'Moscow (GMT+3)' },
  { value: 'America/New_York', label: 'New York (GMT-5/-4)' },
  { value: 'America/Chicago', label: 'Chicago (GMT-6/-5)' },
  { value: 'America/Denver', label: 'Denver (GMT-7/-6)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8/-7)' },
  { value: 'America/Toronto', label: 'Toronto (GMT-5/-4)' },
  { value: 'America/Vancouver', label: 'Vancouver (GMT-8/-7)' },
  { value: 'America/Mexico_City', label: 'Mexico City (GMT-6/-5)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3/-2)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (GMT+8)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (GMT+8)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (GMT+7)' },
  { value: 'Asia/Jakarta', label: 'Jakarta (GMT+7)' },
  { value: 'Asia/Manila', label: 'Manila (GMT+8)' },
  { value: 'Asia/Seoul', label: 'Seoul (GMT+9)' },
  { value: 'Asia/Kolkata', label: 'Kolkata (GMT+5:30)' },
  { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
  { value: 'Asia/Riyadh', label: 'Riyadh (GMT+3)' },
  { value: 'Australia/Sydney', label: 'Sydney (GMT+10/+11)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (GMT+10/+11)' },
  { value: 'Australia/Perth', label: 'Perth (GMT+8)' },
  { value: 'Pacific/Auckland', label: 'Auckland (GMT+12/+13)' },
  { value: 'Africa/Cairo', label: 'Cairo (GMT+2)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (GMT+2)' },
  { value: 'Africa/Lagos', label: 'Lagos (GMT+1)' },
];

const CompanyDetailsSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings, loading, updateSettings } = useCompanySettings();
  const { location, createOrUpdateLocation } = useCompanyLocation();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    website_url: '',
    support_contact: '',
    address_line: '',
    city: '',
    county: '',
    postcode: '',
    country: 'United Kingdom',
    timezone: 'Europe/London',
    session_timeout: '30',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      setFormData(prev => ({
        ...prev,
        email: settings.email || '',
        phone: settings.phone || '',
        website_url: settings.website_url || '',
        support_contact: settings.support_contact || '',
        timezone: settings.timezone || 'Europe/London',
        session_timeout: settings.pin_idle_timeout_seconds?.toString() || '30',
      }));
    }
  }, [settings]);

  useEffect(() => {
    if (location) {
      setFormData(prev => ({
        ...prev,
        address_line: location.address_line || '',
        city: location.city || '',
        county: location.county || '',
        postcode: location.postcode || '',
        country: location.country || 'United Kingdom',
      }));
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    if (!formData.address_line.trim()) {
      newErrors.address_line = 'Address line is required';
    }
    if (!formData.postcode.trim()) {
      newErrors.postcode = 'Postcode is required';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    setSaving(true);
    
    try {
      const settingsData = {
        email: formData.email,
        phone: formData.phone,
        website_url: formData.website_url,
        support_contact: formData.support_contact,
        timezone: formData.timezone,
        pin_idle_timeout_seconds: parseInt(formData.session_timeout)
      };
      
      await updateSettings(settingsData);
      
      const locationData = {
        address_line: formData.address_line,
        city: formData.city,
        county: formData.county,
        country: formData.country,
        postcode: formData.postcode,
      };
      
      await createOrUpdateLocation(locationData);
      
      toast({
        title: "Settings saved",
        description: "Your company details have been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
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
        title="Company Details" 
        subtitle="Manage your company information, location, and system settings" 
      />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Company Information
            </CardTitle>
            <CardDescription>
              Basic contact details for your business
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="company@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  disabled
                  className="bg-muted cursor-not-allowed"
                  placeholder="Not configured"
                />
                <p className="text-xs text-muted-foreground">
                  Phone number is automatically configured when you set up your Twilio integration
                </p>
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
                  placeholder="https://www.example.com"
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
                  placeholder="support@example.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Business Location
            </CardTitle>
            <CardDescription>
              Complete address details for your business location
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address_line">
                  Address Line <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address_line"
                  value={formData.address_line}
                  onChange={(e) => handleChange('address_line', e.target.value)}
                  placeholder="123 High Street"
                  className={errors.address_line ? 'border-red-500' : ''}
                />
                {errors.address_line && (
                  <p className="text-red-500 text-sm">{errors.address_line}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="postcode">
                  Postcode <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="postcode"
                  value={formData.postcode}
                  onChange={(e) => handleChange('postcode', e.target.value.toUpperCase())}
                  placeholder="SW1A 1AA"
                  className={errors.postcode ? 'border-red-500' : ''}
                />
                {errors.postcode && (
                  <p className="text-red-500 text-sm">{errors.postcode}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Town/City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="London"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="county">County/State</Label>
                <Input
                  id="county"
                  value={formData.county}
                  onChange={(e) => handleChange('county', e.target.value)}
                  placeholder="Greater London"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  placeholder="United Kingdom"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timezone Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Timezone Settings
            </CardTitle>
            <CardDescription>
              Select your business operating timezone
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="timezone">Business Timezone</Label>
              <Select value={formData.timezone} onValueChange={(value) => handleChange('timezone', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {TIMEZONES.map((timezone) => (
                    <SelectItem key={timezone.value} value={timezone.value}>
                      {timezone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Session Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Session Security
            </CardTitle>
            <CardDescription>
              Configure automatic session timeout for enhanced security
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="session_timeout">
                Session Lock Timeout (seconds)
              </Label>
              <Select 
                value={formData.session_timeout} 
                onValueChange={(value) => handleChange('session_timeout', value)}
              >
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="120">2 minutes</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                  <SelectItem value="600">10 minutes</SelectItem>
                  <SelectItem value="1800">30 minutes</SelectItem>
                  <SelectItem value="3600">1 hour</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                The system will automatically lock after this period of inactivity
              </p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving || loading} className="w-full">
          {saving ? 'Saving...' : 'Save Company Details'}
        </Button>
      </form>
    </div>
  );
};

export default CompanyDetailsSettings;
