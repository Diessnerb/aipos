
import React from 'react';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useSidebar } from '@/components/ui/sidebar';

const CompanyLogo = () => {
  const { settings, loading } = useCompanySettings();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  if (loading) {
    return (
      <div className={`flex items-center transition-all duration-300 ${
        isCollapsed ? 'justify-center' : 'gap-3'
      }`}>
        <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse flex-shrink-0 aspect-square"></div>
        {!isCollapsed && <div className="w-32 h-5 bg-gray-200 rounded animate-pulse"></div>}
      </div>
    );
  }

  const logoElement = settings?.logo_url ? (
    <img 
      src={settings.logo_url} 
      alt="Company Logo" 
      className="w-10 h-10 object-cover rounded-lg flex-shrink-0 transition-all duration-300 aspect-square"
    />
  ) : (
    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 aspect-square">
      <span className="text-white font-bold text-lg">
        {settings?.company_name?.charAt(0) || 'T'}
      </span>
    </div>
  );

  if (isCollapsed) {
    // When collapsed, show only the centered logo/avatar with perfect square aspect ratio
    return logoElement;
  }

  // When expanded, show logo + company name with proper spacing
  return (
    <div className="flex items-center gap-3 min-w-0 w-full">
      {logoElement}
      <h1 className="font-semibold text-gray-900 text-lg truncate">
        {settings?.company_name || 'The Loom Bar & Cafe'}
      </h1>
    </div>
  );
};

export default CompanyLogo;
