import React from 'react';
// Layout is now handled by MainLayout - no need to import
import { FilteredMenuDisplay } from '@/components/menu/FilteredMenuDisplay';
import { PageHeader } from '@/components/ui/page-header';

const MenuManager = () => {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Menu" 
        subtitle="Browse your restaurant's menu structure and filter menu items" 
      />
      
      <FilteredMenuDisplay />
    </div>
  );
};


export default MenuManager;
