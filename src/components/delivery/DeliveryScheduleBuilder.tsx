import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { useDeliverySchedules } from '@/hooks/useDeliverySchedules';

interface ScheduleRow {
  id?: string;
  orderDay: number;
  deliveryDay: number;
  cutoffTime: string;
}

interface DeliveryScheduleBuilderProps {
  supplierId?: string;
}

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const DeliveryScheduleBuilder: React.FC<DeliveryScheduleBuilderProps> = ({ supplierId }) => {
  const { schedules, createSchedule, deleteSchedule } = useDeliverySchedules(supplierId);
  const schedulesArray = Array.isArray(schedules) ? schedules : [];
  const [newSchedule, setNewSchedule] = useState<ScheduleRow | null>(null);

  // Don't show builder until supplier is created
  if (!supplierId) {
    return (
      <div className="p-4 rounded-md border bg-muted/30 text-center text-sm text-muted-foreground">
        Save the supplier first, then you can add delivery schedules.
      </div>
    );
  }

  const handleAddSchedule = async () => {
    if (!newSchedule || !supplierId) return;

    await createSchedule({
      supplier_id: supplierId,
      company_id: '', // Will be set by the hook
      order_day_of_week: newSchedule.orderDay,
      day_of_week: newSchedule.deliveryDay,
      cutoff_time: newSchedule.cutoffTime || null,
      delivery_time: null,
      is_active: true,
    });

    setNewSchedule(null);
  };

  const handleDeleteSchedule = async (id: string) => {
    await deleteSchedule(id);
  };

  return (
    <div className="space-y-3">
      {schedulesArray.length > 0 && (
        <div className="space-y-2">
          {schedulesArray.map((schedule) => (
            <div
              key={schedule.id}
              className="flex items-center gap-2 p-3 rounded-md border bg-muted/30"
            >
              <div className="flex-1 text-sm">
                <span className="font-medium">
                  Order {DAYS.find(d => d.value === schedule.order_day_of_week)?.label}
                </span>
                {' → '}
                <span className="font-medium">
                  Deliver {DAYS.find(d => d.value === schedule.day_of_week)?.label}
                </span>
                {schedule.cutoff_time && (
                  <span className="text-muted-foreground ml-2">
                    (Cutoff: {schedule.cutoff_time.slice(0, 5)})
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteSchedule(schedule.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {newSchedule ? (
        <div className="space-y-3 p-3 rounded-md border bg-background">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Order Day</Label>
              <Select
                value={newSchedule.orderDay.toString()}
                onValueChange={(value) =>
                  setNewSchedule({ ...newSchedule, orderDay: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Delivery Day</Label>
              <Select
                value={newSchedule.deliveryDay.toString()}
                onValueChange={(value) =>
                  setNewSchedule({ ...newSchedule, deliveryDay: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Cutoff Time (optional)</Label>
            <Input
              type="time"
              value={newSchedule.cutoffTime}
              onChange={(e) =>
                setNewSchedule({ ...newSchedule, cutoffTime: e.target.value })
              }
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={handleAddSchedule} size="sm" className="flex-1">
              Save Schedule
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewSchedule(null)}
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setNewSchedule({
              orderDay: 1,
              deliveryDay: 3,
              cutoffTime: '10:00',
            })
          }
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Schedule
        </Button>
      )}

      {schedulesArray.length === 0 && !newSchedule && (
        <p className="text-sm text-muted-foreground">
          No schedules added yet. Click "Add Schedule" to create one.
        </p>
      )}
    </div>
  );
};
