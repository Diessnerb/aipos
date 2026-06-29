import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Settings, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProposedOrdersTab } from '@/components/delivery/ProposedOrdersTab';
import { PendingDeliveriesTab } from '@/components/delivery/PendingDeliveriesTab';
import { OrderHistoryTab } from '@/components/delivery/OrderHistoryTab';
import { DeliverySettingsDialog } from '@/components/delivery/DeliverySettingsDialog';

const DeliveryPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('proposed');
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Delivery Management</h1>
          <p className="text-muted-foreground">Manage orders, deliveries, and supplier schedules</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/wastage')}>
            <Trash2 className="h-4 w-4 mr-2" />
            Wastage
          </Button>
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="proposed">Proposed Orders</TabsTrigger>
          <TabsTrigger value="pending">Pending Deliveries</TabsTrigger>
          <TabsTrigger value="history">Order History</TabsTrigger>
        </TabsList>

        <div className="flex-1 mt-6">
          <TabsContent value="proposed" className="h-full m-0">
            <ProposedOrdersTab />
          </TabsContent>

          <TabsContent value="pending" className="h-full m-0">
            <PendingDeliveriesTab />
          </TabsContent>

          <TabsContent value="history" className="h-full m-0">
            <OrderHistoryTab />
          </TabsContent>
        </div>
      </Tabs>

      <DeliverySettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};

export default DeliveryPage;
