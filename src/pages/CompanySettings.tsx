
import React from 'react';
import Layout from '@/components/layout/Layout';
import CompanySettingsManager from '@/components/CompanySettingsManager';

const CompanySettings = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Company Settings</h1>
          <p className="text-gray-600">Manage your company information and branding</p>
        </div>

        <CompanySettingsManager />
      </div>
    </Layout>
  );
};

export default CompanySettings;
