import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Copy, Clock } from 'lucide-react';
import { TimeSelectionModal } from '@/components/reservations/TimeSelectionModal';
import { OpeningHoursData, DayOfWeek, DAYS_OF_WEEK, DEFAULT_OPERATING_HOURS, DEFAULT_FOOD_SERVICE_HOURS, FoodServicePeriod } from '@/types/openingHours';
interface OpeningHoursManagerProps {
  value: OpeningHoursData | null;
  onChange: (hours: OpeningHoursData) => void;
}
export function OpeningHoursManager({
  value,
  onChange
}: OpeningHoursManagerProps) {
  const [activeTab, setActiveTab] = useState<'operating' | 'foodService'>('operating');
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [currentTimeField, setCurrentTimeField] = useState<{
    type: 'operating' | 'foodService';
    day: DayOfWeek;
    field: 'open' | 'close' | 'start' | 'end';
    index?: number;
    currentTime: string;
  } | null>(null);
  const hours: OpeningHoursData = value || {
    operating: DEFAULT_OPERATING_HOURS,
    foodService: DEFAULT_FOOD_SERVICE_HOURS
  };
  const openTimeModal = (type: 'operating' | 'foodService', day: DayOfWeek, field: 'open' | 'close' | 'start' | 'end', currentTime: string, index?: number) => {
    setCurrentTimeField({
      type,
      day,
      field,
      currentTime,
      index
    });
    setTimeModalOpen(true);
  };
  const handleTimeSelect = (timeString: string) => {
    if (!currentTimeField) return;
    if (currentTimeField.type === 'operating') {
      updateOperatingDay(currentTimeField.day, currentTimeField.field as 'open' | 'close', timeString);
    } else if (currentTimeField.type === 'foodService' && currentTimeField.index !== undefined) {
      updateFoodServicePeriod(currentTimeField.day, currentTimeField.index, currentTimeField.field as keyof FoodServicePeriod, timeString);
    }
  };
  const updateOperatingDay = (day: DayOfWeek, field: 'open' | 'close' | 'closed', newValue: string | boolean) => {
    onChange({
      ...hours,
      operating: {
        ...hours.operating,
        [day]: {
          ...hours.operating[day],
          [field]: newValue
        }
      }
    });
  };
  const copyOperatingHoursToAll = (sourceDay: DayOfWeek) => {
    const sourceDayHours = hours.operating[sourceDay];
    const newOperating = {
      ...hours.operating
    };
    DAYS_OF_WEEK.forEach(day => {
      newOperating[day] = {
        ...sourceDayHours
      };
    });
    onChange({
      ...hours,
      operating: newOperating
    });
  };
  const addFoodServicePeriod = (day: DayOfWeek) => {
    const newPeriod: FoodServicePeriod = {
      name: 'Lunch',
      start: '12:00',
      end: '15:00'
    };
    onChange({
      ...hours,
      foodService: {
        ...hours.foodService,
        [day]: [...(hours.foodService[day] || []), newPeriod]
      }
    });
  };
  const removeFoodServicePeriod = (day: DayOfWeek, index: number) => {
    const periods = hours.foodService[day].filter((_, i) => i !== index);
    onChange({
      ...hours,
      foodService: {
        ...hours.foodService,
        [day]: periods
      }
    });
  };
  const updateFoodServicePeriod = (day: DayOfWeek, index: number, field: keyof FoodServicePeriod, newValue: string) => {
    const periods = [...hours.foodService[day]];
    periods[index] = {
      ...periods[index],
      [field]: newValue
    };
    onChange({
      ...hours,
      foodService: {
        ...hours.foodService,
        [day]: periods
      }
    });
  };
  const copyFoodServiceToAll = (sourceDay: DayOfWeek) => {
    const sourcePeriods = hours.foodService[sourceDay];
    const newFoodService = {
      ...hours.foodService
    };
    DAYS_OF_WEEK.forEach(day => {
      newFoodService[day] = [...sourcePeriods];
    });
    onChange({
      ...hours,
      foodService: newFoodService
    });
  };
  return <Card className="p-6">
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'operating' | 'foodService')}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="operating">Operating Hours</TabsTrigger>
          <TabsTrigger value="foodService">Food Service Hours</TabsTrigger>
        </TabsList>

        <TabsContent value="operating" className="space-y-4">
          <div className="space-y-3">
            {DAYS_OF_WEEK.map(day => {
            const dayHours = hours.operating[day];
            const isPastMidnight = dayHours.close < dayHours.open;
            return <div key={day} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-24 font-medium capitalize">{day}</div>
                  
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground sr-only">Open</Label>
                      <Button type="button" variant="outline" onClick={() => openTimeModal('operating', day, 'open', dayHours.open)} disabled={dayHours.closed} className="w-28 justify-start font-normal">
                        <Clock className="h-4 w-4 mr-2" />
                        {dayHours.open}
                      </Button>
                    </div>
                    
                    <span className="text-muted-foreground">to</span>
                    
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground sr-only">Close</Label>
                      <Button type="button" variant="outline" onClick={() => openTimeModal('operating', day, 'close', dayHours.close)} disabled={dayHours.closed} className="w-28 justify-start font-normal">
                        <Clock className="h-4 w-4 mr-2" />
                        {dayHours.close}
                      </Button>
                      {isPastMidnight && !dayHours.closed}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox id={`closed-${day}`} checked={dayHours.closed} onCheckedChange={checked => updateOperatingDay(day, 'closed', checked === true)} />
                      <Label htmlFor={`closed-${day}`} className="text-sm cursor-pointer">
                        Closed
                      </Label>
                    </div>

                    <Button type="button" variant="ghost" size="sm" onClick={() => copyOperatingHoursToAll(day)} className="gap-1">
                      <Copy className="h-3 w-3" />
                      Copy to all
                    </Button>
                  </div>
                </div>;
          })}
          </div>
        </TabsContent>

        <TabsContent value="foodService" className="space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            Define specific time periods when food is being served. Leave empty to allow reservations during all operating hours.
          </div>
          
          <div className="space-y-4">
            {DAYS_OF_WEEK.map(day => {
            const periods = hours.foodService[day] || [];
            return <div key={day} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium capitalize">{day}</div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => addFoodServicePeriod(day)} className="gap-1">
                        <Plus className="h-3 w-3" />
                        Add Period
                      </Button>
                      {periods.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => copyFoodServiceToAll(day)} className="gap-1">
                          <Copy className="h-3 w-3" />
                          Copy to all
                        </Button>}
                    </div>
                  </div>

                  {periods.length === 0 ? <div className="text-sm text-muted-foreground italic py-2">
                      No service periods defined - all operating hours available
                    </div> : <div className="space-y-2">
                      {periods.map((period, index) => <div key={index} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                          <Input placeholder="Service name" value={period.name} onChange={e => updateFoodServicePeriod(day, index, 'name', e.target.value)} className="w-32" />
                          <Button type="button" variant="outline" onClick={() => openTimeModal('foodService', day, 'start', period.start, index)} className="w-28 justify-start font-normal">
                            <Clock className="h-4 w-4 mr-2" />
                            {period.start}
                          </Button>
                          <span className="text-muted-foreground">to</span>
                          <Button type="button" variant="outline" onClick={() => openTimeModal('foodService', day, 'end', period.end, index)} className="w-28 justify-start font-normal">
                            <Clock className="h-4 w-4 mr-2" />
                            {period.end}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeFoodServicePeriod(day, index)} className="ml-auto">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>)}
                    </div>}
                </div>;
          })}
          </div>
        </TabsContent>
      </Tabs>

      <TimeSelectionModal isOpen={timeModalOpen} onClose={() => setTimeModalOpen(false)} onTimeSelect={handleTimeSelect} currentTime={currentTimeField?.currentTime} />
    </Card>;
}