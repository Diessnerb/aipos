import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useCompanyFilteredData } from '@/hooks/useCompanyFilteredData';
import { useOrderBasket, OrderAssignment as OrderAssignmentType } from '@/contexts/OrderBasketContext';
import { Users, ChevronDown, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, addDays, isBefore, isToday, isTomorrow } from 'date-fns';
import { getMinimumPickupTime } from '@/utils/timeUtils';
import { useToast } from '@/hooks/use-toast';

interface Table {
  id: string;
  table_number: number;
  table_name: string;
}

export const OrderAssignment = () => {
  const { orderAssignment, setOrderAssignment, scheduledFor, setScheduledFor } = useOrderBasket();
  const { data: tables } = useCompanyFilteredData<Table>('tables', '*', { column: 'table_number', ascending: true });
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [assignmentType, setAssignmentType] = useState<'table' | 'customer_name'>(
    orderAssignment?.type || 'table'
  );
  const [selectedTable, setSelectedTable] = useState<string>(
    orderAssignment?.tableNumber?.toString() || ''
  );
  const [customerName, setCustomerName] = useState<string>(
    orderAssignment?.customerName || ''
  );

  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(!!scheduledFor);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    scheduledFor ? new Date(scheduledFor) : new Date()
  );
  const [selectedTime, setSelectedTime] = useState(
    scheduledFor ? format(new Date(scheduledFor), 'HH:mm') : format(getMinimumPickupTime(), 'HH:mm')
  );

  useEffect(() => {
    // Update context when values change
    if (assignmentType === 'table' && selectedTable) {
      setOrderAssignment({
        type: 'table',
        tableNumber: parseInt(selectedTable),
      });
    } else if (assignmentType === 'customer_name') {
      const trimmed = customerName.trim();
      if (trimmed) {
        setOrderAssignment({
          type: 'customer_name',
          customerName: trimmed,
        });
      } else if (customerName === '') {
        setOrderAssignment(null);
      } else {
        // Spaces-only while typing: do not update context to avoid resetting the input
      }
    } else {
      setOrderAssignment(null);
    }
  }, [assignmentType, selectedTable, customerName, setOrderAssignment]);

  // Reset local state when orderAssignment is cleared from outside
  useEffect(() => {
    if (orderAssignment === null) {
      setSelectedTable('');
      setCustomerName('');
      setAssignmentType('table');
    }
  }, [orderAssignment]);

  // Sync local state when orderAssignment is set from outside
  useEffect(() => {
    if (orderAssignment?.type === 'table' && orderAssignment.tableNumber) {
      setAssignmentType('table');
      setSelectedTable(orderAssignment.tableNumber.toString());
      setCustomerName('');
    } else if (orderAssignment?.type === 'customer_name' && orderAssignment.customerName) {
      setAssignmentType('customer_name');
      setSelectedTable('');
      setCustomerName(orderAssignment.customerName);
    }
  }, [orderAssignment]);

  // Sync with scheduledFor from context
  useEffect(() => {
    if (scheduledFor) {
      setIsScheduled(true);
      setSelectedDate(new Date(scheduledFor));
      setSelectedTime(format(new Date(scheduledFor), 'HH:mm'));
    }
  }, [scheduledFor]);

  const handleTypeChange = (value: string) => {
    setAssignmentType(value as 'table' | 'customer_name');
    if (value === 'table') {
      setCustomerName('');
    } else {
      setSelectedTable('');
    }
  };

  // Update scheduledFor when date/time changes
  const updateScheduledFor = (date: Date, time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const scheduledDateTime = new Date(date);
    scheduledDateTime.setHours(hours, minutes, 0, 0);
    
    // Validation: must be at least 45 minutes from now
    const minTime = getMinimumPickupTime();
    if (isBefore(scheduledDateTime, minTime)) {
      toast({
        title: "Invalid Time",
        description: "Pickup time must be at least 45 minutes from now",
        variant: "destructive"
      });
      return;
    }
    
    setScheduledFor(scheduledDateTime);
  };

  // Generate time slots (15-minute intervals)
  const generateTimeSlots = (date: Date | undefined) => {
    const slots: { value: string; label: string; disabled: boolean }[] = [];
    const minTime = getMinimumPickupTime();
    const selectedDateObj = date || new Date();
    const isSelectedToday = isToday(selectedDateObj);
    
    let startHour = 0;
    let startMinute = 0;
    
    if (isSelectedToday) {
      startHour = minTime.getHours();
      startMinute = Math.ceil(minTime.getMinutes() / 15) * 15;
      if (startMinute === 60) {
        startHour += 1;
        startMinute = 0;
      }
    }
    
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (isSelectedToday && (hour < startHour || (hour === startHour && minute < startMinute))) {
          continue;
        }
        
        const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = format(new Date(2000, 0, 1, hour, minute), 'h:mm a');
        
        const slotDateTime = new Date(selectedDateObj);
        slotDateTime.setHours(hour, minute, 0, 0);
        const isDisabled = isSelectedToday && isBefore(slotDateTime, minTime);
        
        slots.push({ value: timeValue, label: displayTime, disabled: isDisabled });
      }
    }
    
    return slots;
  };

  // Get display text for collapsed header
  const getHeaderText = () => {
    let baseText = '';
    if (assignmentType === 'table' && selectedTable) {
      const table = tables?.find(t => t.table_number.toString() === selectedTable);
      baseText = `Table ${selectedTable}${table?.table_name ? ` - ${table.table_name}` : ''}`;
    } else if (assignmentType === 'customer_name' && customerName.trim()) {
      baseText = customerName.trim();
    } else {
      baseText = 'Assign the order';
    }
    
    // Add scheduled time if set
    if (scheduledFor) {
      const dateStr = isToday(scheduledFor) 
        ? 'Today' 
        : isTomorrow(scheduledFor) 
          ? 'Tomorrow' 
          : format(scheduledFor, 'MMM d');
      const timeStr = format(scheduledFor, 'h:mm a');
      return `${baseText} - 📅 ${dateStr} ${timeStr}`;
    }
    
    return baseText;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full group">
        <div className="flex items-center justify-between py-2 hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className={selectedTable || customerName.trim() ? 'font-medium' : 'text-muted-foreground'}>
              {getHeaderText()}
            </span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="space-y-3 pt-3">
          <RadioGroup value={assignmentType} onValueChange={handleTypeChange} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="table" id="table" />
              <Label htmlFor="table" className="cursor-pointer font-normal">Dine In</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="customer_name" id="customer_name" />
              <Label htmlFor="customer_name" className="cursor-pointer font-normal">Takeaway</Label>
            </div>
          </RadioGroup>

          {assignmentType === 'table' ? (
            <div className="space-y-2">
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {tables && tables.length > 0 ? (
                    tables.map((table) => (
                      <SelectItem key={table.id} value={table.table_number.toString()}>
                        Table {table.table_number} {table.table_name && `- ${table.table_name}`}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No tables available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter customer name (e.g., Takeaway - John)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          )}

          {/* Scheduling Section */}
          <div className="pt-3 border-t space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="schedule-later" 
                checked={isScheduled}
                onCheckedChange={(checked) => {
                  setIsScheduled(!!checked);
                  if (!checked) {
                    setScheduledFor(null);
                    setSelectedDate(new Date());
                    setSelectedTime(format(getMinimumPickupTime(), 'HH:mm'));
                  } else {
                    const date = selectedDate || new Date();
                    updateScheduledFor(date, selectedTime);
                  }
                }}
              />
              <Label htmlFor="schedule-later" className="cursor-pointer font-medium">
                Schedule for specific time
              </Label>
            </div>
            
            {isScheduled && (
              <div className="space-y-3 pl-6">
                {/* Date Picker */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Pickup Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          if (date) {
                            setSelectedDate(date);
                            updateScheduledFor(date, selectedTime);
                          }
                        }}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const twoWeeksFromNow = addDays(today, 14);
                          twoWeeksFromNow.setHours(23, 59, 59, 999);
                          return isBefore(date, today) || isBefore(twoWeeksFromNow, date);
                        }}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* Time Picker */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Pickup Time</Label>
                  <Select 
                    value={selectedTime} 
                    onValueChange={(time) => {
                      setSelectedTime(time);
                      if (selectedDate) {
                        updateScheduledFor(selectedDate, time);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <Clock className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {generateTimeSlots(selectedDate).map((slot) => (
                        <SelectItem key={slot.value} value={slot.value} disabled={slot.disabled}>
                          {slot.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Helper text */}
                {selectedDate && selectedTime && scheduledFor && (
                  <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded flex items-start gap-2">
                    <Clock className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>
                      Kitchen will see this order at{' '}
                      <strong>
                        {format(new Date(scheduledFor.getTime() - 60 * 60 * 1000), 'PPP')} at{' '}
                        {format(new Date(scheduledFor.getTime() - 60 * 60 * 1000), 'h:mm a')}
                      </strong>
                      {' '}(1 hour before pickup)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};