import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useDeliverySettings } from '@/hooks/useDeliverySettings';

interface DeliverySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DeliverySettingsDialog: React.FC<DeliverySettingsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { settings, updateSettings, isUpdating } = useDeliverySettings();
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    if (settings) {
      reset(settings);
    }
  }, [settings, reset]);

  const onSubmit = (data: any) => {
    updateSettings(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>⚙️ Delivery Settings</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Master Controls</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_generate_orders"
                  {...register('auto_generate_orders')}
                  className="h-4 w-4"
                />
                <Label htmlFor="auto_generate_orders">Auto-generate orders on order day</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="require_approval"
                  {...register('require_approval')}
                  className="h-4 w-4"
                />
                <Label htmlFor="require_approval">Require approval before sending</Label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Stock & Inventory</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="track_wastage"
                  {...register('track_wastage')}
                  className="h-4 w-4"
                />
                <Label htmlFor="track_wastage">Track wastage</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enable_fifo_tracking"
                  {...register('enable_fifo_tracking')}
                  className="h-4 w-4"
                />
                <Label htmlFor="enable_fifo_tracking">Enable FIFO tracking</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enable_shelf_life_alerts"
                  {...register('enable_shelf_life_alerts')}
                  className="h-4 w-4"
                />
                <Label htmlFor="enable_shelf_life_alerts">Enable shelf-life alerts</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_stock_deduction"
                  {...register('auto_stock_deduction')}
                  className="h-4 w-4"
                />
                <Label htmlFor="auto_stock_deduction">Auto-update stock on delivery check-in</Label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Calculation Parameters</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="low_stock_threshold_days">Low Stock Alert (days remaining)</Label>
                <Input
                  id="low_stock_threshold_days"
                  type="number"
                  {...register('low_stock_threshold_days', { valueAsNumber: true })}
                />
              </div>
              <div>
                <Label htmlFor="lead_time_buffer_days">Lead Time Buffer (extra days)</Label>
                <Input
                  id="lead_time_buffer_days"
                  type="number"
                  {...register('lead_time_buffer_days', { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              💾 {isUpdating ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
