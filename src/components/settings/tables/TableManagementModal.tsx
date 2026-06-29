import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Settings2, AlertTriangle, Plus, Edit, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Table } from '@/types/table';

const tableSchema = z.object({
  table_number: z.number().min(1, 'Table number is required'),
  table_name: z.string().optional(),
  seats: z.number().min(1, 'At least 1 seat is required').max(20, 'Maximum 20 seats allowed'),
  type: z.string().optional(),
  shape: z.string().optional(),
  accessibility_friendly: z.boolean().default(false),
  description: z.string().optional(),
  can_combine: z.boolean().default(false),
  // Advanced features
  vip_status: z.boolean().default(false),
  window_seating: z.boolean().default(false),
  privacy_level: z.enum(['public', 'semi-private', 'private', 'vip']).optional().nullable(),
  
  is_high_top: z.boolean().default(false),
  is_main_dining: z.boolean().default(false),
  is_outdoor: z.boolean().default(false),
  is_quiet_area: z.boolean().default(false),
  is_dog_friendly: z.boolean().default(false),
  service_status: z.enum(['available', 'out_of_service', 'temporarily_removed']).default('available'),
});

type TableFormData = z.infer<typeof tableSchema>;

const TABLE_TYPES = [
  'Standard',
  'Booth',
  'Tall Table',
];

const TABLE_SHAPES = [
  'Rectangle',
  'Round',
  'Square',
  'Oval',
];



interface TableManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Table | null;
  onSubmit: (data: TableFormData) => Promise<void>;
  loading?: boolean;
  tables?: Table[];
}

export const TableManagementModal: React.FC<TableManagementModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSubmit,
  loading = false,
  tables = [],
}) => {
  const isEditing = !!initialData;

  // Helper function to get next available table number
  const getNextAvailableTableNumber = (): number => {
    if (!tables || tables.length === 0) return 1;
    
    const existingNumbers = tables.map(t => t.table_number).sort((a, b) => a - b);
    
    // Find the first gap in numbering
    for (let i = 1; i <= existingNumbers.length; i++) {
      if (!existingNumbers.includes(i)) {
        return i;
      }
    }
    
    // If no gaps, return max + 1
    return Math.max(...existingNumbers) + 1;
  };

  // Client-side validation for duplicate table numbers
  const isDuplicateTableNumber = (tableNumber: number): boolean => {
    if (isEditing && initialData?.table_number === tableNumber) {
      return false; // Allow keeping the same number when editing
    }
    return tables.some(t => t.table_number === tableNumber);
  };
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
    getValues,
  } = useForm<TableFormData>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      table_number: initialData?.table_number || 1,
      table_name: initialData?.table_name || '',
      seats: initialData?.seats || 4,
      type: initialData?.type || '',
      shape: initialData?.shape || '',
      accessibility_friendly: initialData?.accessibility_friendly || false,
      description: initialData?.description || '',
      can_combine: initialData?.can_combine ?? false,
      // Advanced features
      vip_status: initialData?.vip_status || false,
      window_seating: initialData?.window_seating || false,
      privacy_level: (initialData?.privacy_level ?? undefined) as 'public' | 'semi-private' | 'private' | 'vip' | undefined,
      
      is_high_top: initialData?.is_high_top || false,
      is_main_dining: initialData?.is_main_dining || false,
      is_outdoor: initialData?.is_outdoor || false,
      is_quiet_area: initialData?.is_quiet_area || false,
      is_dog_friendly: initialData?.is_dog_friendly || false,
      service_status: initialData?.service_status || 'available',
    },
  });

  const accessibilityFriendly = watch('accessibility_friendly');
  const canCombine = watch('can_combine');
  const currentType = watch('type');
  const currentShape = watch('shape');
  
  

  // Watch advanced features
  const vipStatus = watch('vip_status');
  const windowSeating = watch('window_seating');
  const isHighTop = watch('is_high_top');
  const isMainDining = watch('is_main_dining');
  const isOutdoor = watch('is_outdoor');
  const isQuietArea = watch('is_quiet_area');
  const isDogFriendly = watch('is_dog_friendly');

  // Set initial values for selects
  React.useEffect(() => {
    if (initialData) {
      if (initialData.type) setValue('type', initialData.type);
      if (initialData.shape) setValue('shape', initialData.shape);
      if (initialData.privacy_level) setValue('privacy_level', initialData.privacy_level as 'public' | 'semi-private' | 'private' | 'vip');
      
      if (initialData.is_main_dining) setValue('is_main_dining', initialData.is_main_dining);
    }
  }, [initialData, setValue]);

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (isOpen && !initialData) {
      const nextTableNumber = getNextAvailableTableNumber();
      reset({
        table_number: nextTableNumber,
        table_name: '',
        seats: 4,
        type: '',
        shape: '',
        accessibility_friendly: false,
        description: '',
        can_combine: false,
        vip_status: false,
        window_seating: false,
        privacy_level: undefined,
        
        is_high_top: false,
        is_main_dining: false,
        is_outdoor: false,
        is_quiet_area: false,
        is_dog_friendly: false,
        service_status: 'available',
      });
    }
  }, [isOpen, initialData, reset, tables]);

  // Populate form with existing data when editing
  React.useEffect(() => {
    if (isOpen && initialData) {
      console.log('🔍 [TableModal] Initializing form with data:', {
        tableNumber: initialData.table_number,
        tableName: initialData.table_name,
        can_combine: initialData.can_combine,
        can_combine_type: typeof initialData.can_combine
      });
      
      reset({
        table_number: initialData.table_number,
        table_name: initialData.table_name || '',
        seats: initialData.seats,
        type: initialData.type || '',
        shape: initialData.shape || '',
        accessibility_friendly: initialData.accessibility_friendly || false,
        description: initialData.description || '',
        can_combine: initialData.can_combine ?? false,
        vip_status: initialData.vip_status || false,
        window_seating: initialData.window_seating || false,
        privacy_level: (initialData.privacy_level ?? undefined) as 'public' | 'semi-private' | 'private' | 'vip' | undefined,
        
        is_high_top: initialData.is_high_top || false,
        is_main_dining: initialData.is_main_dining || false,
        is_outdoor: initialData.is_outdoor || false,
        is_quiet_area: initialData.is_quiet_area || false,
        is_dog_friendly: initialData.is_dog_friendly || false,
        service_status: initialData.service_status || 'available',
      });
    }
  }, [isOpen, initialData, reset]);

  const handleFormSubmit = async (data: TableFormData) => {
    // Use getValues() to ensure ALL registered fields are included
    const allFormValues = getValues();
    
    console.log('🔘 [TableModal] Form submit triggered', { 
      isEditing, 
      data,
      allFormValues,
      service_status: allFormValues.service_status,
      errors: errors 
    });
    
    // Check for duplicate table number before submission
    if (isDuplicateTableNumber(data.table_number)) {
      console.log('❌ [TableModal] Duplicate table number blocked:', data.table_number);
      return; // Validation will show the error
    }

    try {
      // Auto-generate table_name if not provided
      const submissionData = {
        ...allFormValues,
        table_name: allFormValues.table_name || `Table ${allFormValues.table_number}`,
      };
      
      console.log('✅ [TableModal] Submitting complete table data:', submissionData);
      await onSubmit(submissionData);
      console.log('✅ [TableModal] Submission successful');
      onClose();
    } catch (error) {
      console.error('❌ [TableModal] Submission error:', error);
      throw error;
    }
  };

  const handleFormError = (formErrors: any) => {
    console.error('❌ [TableModal] Validation errors:', formErrors);
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-[90vw] lg:w-[80vw] max-w-none max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Edit className="h-5 w-5" />
                Edit Table {initialData?.table_number}
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Add New Table
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the table information below.'
              : 'Enter the details for your new table.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit, handleFormError)} className="space-y-6">
          {/* Flexbox Layout: Left Section (Columns 1-2 + Service Status) | Right Section (Column 3) */}
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Left Section: Columns 1-2 Grid + Service Status Row */}
            <div className="flex-[7] space-y-6">
              {/* 2-Column Grid for Basic Info and Extended Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                {/* Column 1: Basic Table Info */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-start gap-2">
                      <Label htmlFor="table_number">Table Number *</Label>
                    </div>
                    <Input
                      id="table_number"
                      type="number"
                      {...register('table_number', { valueAsNumber: true })}
                      className="mt-1"
                    />
                    {errors.table_number && (
                      <p className="text-destructive text-sm mt-1">{errors.table_number.message}</p>
                    )}
                    {isDuplicateTableNumber(watch('table_number')) && (
                      <p className="text-destructive text-sm mt-1">
                        Table {watch('table_number')} already exists. Please choose a different number.
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-start gap-2">
                      <Label htmlFor="seats">Seats *</Label>
                    </div>
                    <Input
                      id="seats"
                      type="number"
                      min="1"
                      max="20"
                      {...register('seats', { valueAsNumber: true })}
                      className="mt-1"
                    />
                    {errors.seats && (
                      <p className="text-destructive text-sm mt-1">{errors.seats.message}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-start gap-2">
                      <Label htmlFor="type">Table Type</Label>
                    </div>
                    <Select value={currentType} onValueChange={(value) => {
                      setValue('type', value);
                      if (value === 'Tall Table') {
                        setValue('is_high_top', true);
                      }
                    }}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {TABLE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </div>

                {/* Column 2: Extended Table Details */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-start gap-2">
                      <Label htmlFor="table_name">Table Name</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>This is what will be displayed on the reservations timeline view</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      id="table_name"
                      {...register('table_name')}
                      placeholder="e.g., T2"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <div className="flex items-start gap-2">
                      <Label htmlFor="shape">Table Shape</Label>
                    </div>
                    <Input
                      id="shape"
                      value="Coming Soon"
                      disabled
                      className="mt-1 bg-muted text-muted-foreground cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <div className="flex items-start gap-2">
                      <Label htmlFor="description">Description/Notes</Label>
                    </div>
                    <Input
                      id="description"
                      {...register('description')}
                      placeholder="Additional details about this table..."
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Service Status Row - Spans Full Width Below Grid */}
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-medium">Service Status</h4>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Is this table currently available?</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="service_available" className="text-sm font-medium">
                      Available
                    </Label>
                    {watch('service_status') !== 'available' && (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <Switch
                    id="service_available"
                    checked={watch('service_status') === 'available'}
                    onCheckedChange={(checked) => {
                      setValue('service_status', checked ? 'available' : 'out_of_service', {
                        shouldDirty: true,
                        shouldValidate: true
                      });
                    }}
                  />
                </div>
                
                {watch('service_status') !== 'available' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="out_of_service"
                          value="out_of_service"
                          checked={watch('service_status') === 'out_of_service'}
                          onChange={() => {
                            console.log('📻 [TableModal] Radio changed to: out_of_service');
                            setValue('service_status', 'out_of_service', {
                              shouldDirty: true,
                              shouldValidate: true
                            });
                          }}
                          className="h-3 w-3 text-primary cursor-pointer"
                        />
                        <Label htmlFor="out_of_service" className="text-sm cursor-pointer">
                          Out of Service
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground ml-5">
                        Out of Service refers to a table that can't be used but is still present in the table location at the premises
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="temporarily_removed"
                          value="temporarily_removed"
                          checked={watch('service_status') === 'temporarily_removed'}
                          onChange={() => {
                            console.log('📻 [TableModal] Radio changed to: temporarily_removed');
                            setValue('service_status', 'temporarily_removed', {
                              shouldDirty: true,
                              shouldValidate: true
                            });
                          }}
                          className="h-3 w-3 text-primary cursor-pointer"
                        />
                        <Label htmlFor="temporarily_removed" className="text-sm cursor-pointer">
                          Temporarily Removed
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground ml-5">
                        Temporarily Removed refers to a table that has been removed from the location it was in at the premises
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Section: Column 3 - Advanced Features */}
            <div className="flex-[3] space-y-2">
              <div className="space-y-2">
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="vip_status"
                    checked={vipStatus}
                    onCheckedChange={(checked) => setValue("vip_status", !!checked, { shouldDirty: true, shouldValidate: true })}
                  />
                  <Label htmlFor="vip_status" className="text-sm">VIP Table</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="accessibility_friendly"
                    checked={accessibilityFriendly}
                    onCheckedChange={(checked) => setValue('accessibility_friendly', !!checked, { shouldDirty: true, shouldValidate: true })}
                  />
                  <Label htmlFor="accessibility_friendly" className="text-sm">Wheelchair Accessible</Label>
                </div>

                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="window_seating"
                    checked={windowSeating}
                    onCheckedChange={(checked) => setValue("window_seating", !!checked, { shouldDirty: true, shouldValidate: true })}
                  />
                  <Label htmlFor="window_seating" className="text-sm">Window View</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_outdoor"
                    checked={isOutdoor}
                    onCheckedChange={(checked) => setValue("is_outdoor", !!checked, { shouldDirty: true, shouldValidate: true })}
                  />
                  <Label htmlFor="is_outdoor" className="text-sm">Outdoor Seating</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_quiet_area"
                    checked={isQuietArea}
                    onCheckedChange={(checked) => setValue("is_quiet_area", !!checked, { shouldDirty: true, shouldValidate: true })}
                  />
                  <Label htmlFor="is_quiet_area" className="text-sm">Quiet Area</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_main_dining"
                    checked={isMainDining}
                    onCheckedChange={(checked) => setValue("is_main_dining", !!checked, { shouldDirty: true, shouldValidate: true })}
                  />
                  <Label htmlFor="is_main_dining" className="text-sm">Main Dining Area</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_dog_friendly"
                    checked={isDogFriendly}
                    onCheckedChange={(checked) => setValue("is_dog_friendly", !!checked, { shouldDirty: true, shouldValidate: true })}
                  />
                  <Label htmlFor="is_dog_friendly" className="text-sm">Dog Friendly</Label>
                </div>
              </div>

            </div>
          </div>

          {/* Table Combination Options */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium">Table Combination</h4>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="can_combine"
                checked={canCombine}
                onCheckedChange={(checked) => setValue('can_combine', !!checked, { shouldDirty: true, shouldValidate: true })}
              />
              <Label htmlFor="can_combine" className="text-sm font-medium">
                Can this table combine with others
              </Label>
            </div>
            
            {canCombine && (
              <p className="text-sm text-muted-foreground ml-6">
                This table can be combined with others in Table Groups. Configure group settings and table priority in the Table Groups tab.
              </p>
            )}
          </div>


          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (isEditing ? 'Update Table' : 'Create Table')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};