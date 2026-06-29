import React, { useState } from 'react';
// Layout is now handled by MainLayout - no need to import
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
import { useCompanySettings } from '@/hooks/useCompanySettings';

const LegalPolicySettings = () => {
  const navigate = useNavigate();
  const { settings, loading, updateSettings } = useCompanySettings();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    terms_of_service_url: settings?.terms_of_service_url || '',
    privacy_policy_url: settings?.privacy_policy_url || '',
    terms_url: settings?.terms_url || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings(formData);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
        title="Legal & Policy Settings" 
        subtitle="Configure your legal documents and policies" 
      />

      <div className="max-w-2xl space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="terms_of_service_url">Terms of Service URL</Label>
              <Input
                id="terms_of_service_url"
                type="url"
                value={formData.terms_of_service_url}
                onChange={(e) => handleChange('terms_of_service_url', e.target.value)}
                placeholder="https://yoursite.com/terms-of-service"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="privacy_policy_url">Privacy Policy URL</Label>
              <Input
                id="privacy_policy_url"
                type="url"
                value={formData.privacy_policy_url}
                onChange={(e) => handleChange('privacy_policy_url', e.target.value)}
                placeholder="https://yoursite.com/privacy-policy"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms_url">General Terms URL</Label>
              <Input
                id="terms_url"
                type="url"
                value={formData.terms_url}
                onChange={(e) => handleChange('terms_url', e.target.value)}
                placeholder="https://yoursite.com/terms"
              />
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Compliance Notice</h4>
            <p className="text-sm text-muted-foreground">
              Ensure your legal documents comply with applicable laws and regulations in your jurisdiction. 
              These URLs will be linked in your application where appropriate.
            </p>
          </div>

          <Button type="submit" disabled={saving || loading} className="w-full">
            {saving ? 'Saving...' : 'Save Legal Settings'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LegalPolicySettings;