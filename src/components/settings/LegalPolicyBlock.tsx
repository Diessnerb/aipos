
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Shield, Scale } from 'lucide-react';

interface LegalPolicyBlockProps {
  terms_of_service_url: string | null;
  privacy_policy_url: string | null;
  terms_url: string | null;
  onSave: (data: {
    terms_of_service_url: string;
    privacy_policy_url: string;
    terms_url: string;
  }) => void;
  loading?: boolean;
}

const LegalPolicyBlock = ({ 
  terms_of_service_url,
  privacy_policy_url,
  terms_url,
  onSave,
  loading = false 
}: LegalPolicyBlockProps) => {
  const [formData, setFormData] = useState({
    terms_of_service_url: terms_of_service_url || '',
    privacy_policy_url: privacy_policy_url || '',
    terms_url: terms_url || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="w-5 h-5" />
          Legal and Policy Settings
        </CardTitle>
        <CardDescription>
          Manage your legal documents and compliance requirements
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="terms_of_service_url" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Terms of Service URL
              </Label>
              <Input
                id="terms_of_service_url"
                type="url"
                value={formData.terms_of_service_url}
                onChange={(e) => handleChange('terms_of_service_url', e.target.value)}
                placeholder="https://www.business.com/terms"
              />
              <p className="text-xs text-gray-500">
                Link to your terms of service document
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="privacy_policy_url" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Privacy Policy URL
              </Label>
              <Input
                id="privacy_policy_url"
                type="url"
                value={formData.privacy_policy_url}
                onChange={(e) => handleChange('privacy_policy_url', e.target.value)}
                placeholder="https://www.business.com/privacy"
              />
              <p className="text-xs text-gray-500">
                Link to your privacy policy document
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms_url" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                General Terms URL
              </Label>
              <Input
                id="terms_url"
                type="url"
                value={formData.terms_url}
                onChange={(e) => handleChange('terms_url', e.target.value)}
                placeholder="https://www.business.com/general-terms"
              />
              <p className="text-xs text-gray-500">
                Link to your general terms and conditions
              </p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Legal Compliance:</strong> Ensure all documents are regularly updated and comply with applicable laws and regulations in your jurisdiction.
            </p>
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

export default LegalPolicyBlock;
