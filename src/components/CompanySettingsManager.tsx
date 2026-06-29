import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Building2 } from 'lucide-react';
import ExpandableTeamMembersCard from './settings/ExpandableTeamMembersCard';
import ExpandableBrandingCard from './settings/ExpandableBrandingCard';
import ExpandableLegalPolicyCard from './settings/ExpandableLegalPolicyCard';
import ExpandableIntegrationsCard from './settings/ExpandableIntegrationsCard';
import AccessLevelCard from './settings/AccessLevelCard';
import { useNavigate } from 'react-router-dom';

const CompanySettingsManager = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Redirect to new unified page */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Company Details
          </CardTitle>
          <CardDescription>
            Manage all your company information in one place
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Company details, contact information, location, and system settings have been moved to a unified page for easier management.
          </p>
          <Button onClick={() => navigate('/settings/company-details')} className="flex items-center gap-2">
            Go to Company Details
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Team Members */}
        <div className="h-[280px] flex flex-col">
          <ExpandableTeamMembersCard />
        </div>

        {/* Branding Customization */}
        <div className="h-[280px] flex flex-col">
          <ExpandableBrandingCard
            primary_color={undefined}
            secondary_color={undefined}
            font_style={undefined}
            button_style={undefined}
            show_allergen_disclaimer={undefined}
            onSave={async () => {}}
            loading={false}
          />
        </div>

        {/* Legal & Policy Settings */}
        <div className="h-[280px] flex flex-col">
          <ExpandableLegalPolicyCard
            terms_of_service_url={undefined}
            privacy_policy_url={undefined}
            terms_url={undefined}
            onSave={async () => {}}
            loading={false}
          />
        </div>

        {/* Third-Party Integrations */}
        <div className="h-[280px] flex flex-col">
          <ExpandableIntegrationsCard />
        </div>

        {/* Access Level Settings */}
        <div className="h-[280px] flex flex-col">
          <AccessLevelCard />
        </div>
      </div>
    </div>
  );
};

export default CompanySettingsManager;