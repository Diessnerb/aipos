import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield } from 'lucide-react';
import ExpandableSettingsCard from './ExpandableSettingsCard';

interface ExpandableLegalPolicyCardProps {
  terms_of_service_url?: string | null;
  privacy_policy_url?: string | null;
  terms_url?: string | null;
  onSave: (data: {
    terms_of_service_url: string;
    privacy_policy_url: string;
    terms_url: string;
  }) => Promise<void>;
  loading?: boolean;
}

const ExpandableLegalPolicyCard = ({
  terms_of_service_url,
  privacy_policy_url,
  terms_url,
  onSave,
  loading = false
}: ExpandableLegalPolicyCardProps) => {
  const [formData, setFormData] = useState({
    terms_of_service_url: terms_of_service_url || '',
    privacy_policy_url: privacy_policy_url || '',
    terms_url: terms_url || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <ExpandableSettingsCard
      title="Legal & Policy Settings"
      description="Configure your legal document links and compliance settings"
      icon={<Shield className="w-5 h-5 text-primary" />}
    >
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

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Saving...' : 'Save Legal Settings'}
        </Button>
      </form>
    </ExpandableSettingsCard>
  );
};

export default ExpandableLegalPolicyCard;