import React, { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { KitchenDisplay } from '@/components/kitchen/KitchenDisplay';
import { DeviceDataManager } from '@/device/DeviceDataManager';
import { getBoundCompany } from '@/utils/deviceBinding';

const Kitchen = () => {
  const { isAdmin, isManager, isStaff, companyId } = useAuth();
  
  // One-shot repair check on mount
  useEffect(() => {
    const bound = getBoundCompany();
    const effectiveCompanyId = companyId || bound?.company_id;
    if (effectiveCompanyId) {
      DeviceDataManager.ensureCriticalCaches(effectiveCompanyId);
    }
  }, [companyId]);
  
  // Check if user has access (admin, manager, or staff)
  if (!isAdmin && !isManager && !isStaff) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h1>
          <p className="text-gray-600">This page is only accessible to restaurant staff.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background overflow-hidden">
      <KitchenDisplay />
    </div>
  );
};

export default Kitchen;
