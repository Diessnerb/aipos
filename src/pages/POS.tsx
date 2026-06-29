import React, { useEffect } from 'react';
import { useOrderBasket } from '@/contexts/OrderBasketContext';
import { POSMenuDisplay } from '@/components/pos/POSMenuDisplay';
import { OrderBasket } from '@/components/pos/OrderBasket';
import { PaymentPanel } from '@/components/pos/PaymentPanelWithSave';
import { KitchenReadyNotificationsBar } from '@/components/pos/KitchenReadyNotificationsBar';
import { DeviceDataManager } from '@/device/DeviceDataManager';
import { useCompanyId } from '@/hooks/useCompanyId';

const POS = () => {
  const { isPaymentMode } = useOrderBasket();
  const { companyId } = useCompanyId();
  
  // One-shot repair check on mount
  useEffect(() => {
    if (companyId) {
      DeviceDataManager.ensureCriticalCaches(companyId);
    }
  }, [companyId]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Menu (65%) or Order Basket (35%) in payment mode */}
        <div 
          className={`flex flex-col overflow-hidden transition-all duration-300 ${
            isPaymentMode ? 'w-[35%]' : 'w-[65%]'
          }`}
        >
        {isPaymentMode ? (
          <div className="h-full">
            <OrderBasket />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <KitchenReadyNotificationsBar />
            <div className="flex-1 overflow-y-auto p-6">
              <POSMenuDisplay />
            </div>
          </div>
        )}
        </div>

        {/* Right Column - Order Basket (35%) or Payment Panel (65%) */}
        <div 
          className={`border-l flex-shrink-0 transition-all duration-300 ${
            isPaymentMode ? 'w-[65%]' : 'w-[35%]'
          }`}
        >
          <div className="h-full sticky top-0">
            {isPaymentMode ? <PaymentPanel /> : <OrderBasket />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default POS;
