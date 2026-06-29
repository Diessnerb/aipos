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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Loader2, ChevronDown, ChevronUp, Settings, AlertTriangle } from 'lucide-react';

const tableSchema = z.object({
  table_number: z.coerce.number().min(1, 'Table number is required'),
  seats: z.coerce.number().min(1, 'At least 1 seat is required').max(20, 'Maximum 20 seats allowed'),
  type: z.string().optional(),
  shape: z.string().optional(),
  accessibility_friendly: z.boolean().default(false),
  description: z.string().optional(),
  can_combine: z.boolean().default(false),
  // Enhanced features
  vip_status: z.boolean().optional(),
  window_seating: z.boolean().optional(),
  privacy_level: z.enum(['public', 'semi-private', 'private', 'vip']).optional(),
  ambiance: z.enum(['casual', 'upscale', 'romantic', 'business']).optional(),
  is_high_top: z.boolean().optional(),
  is_outdoor: z.boolean().optional(),
  is_quiet_area: z.boolean().optional(),
  is_main_dining: z.boolean().optional(),
  is_family_friendly: z.boolean().optional(),
  is_business_friendly: z.boolean().optional(),
  // Service status
  service_status: z.enum(['available', 'out_of_service', 'temporarily_removed']).default('available'),
});

type TableFormData = z.infer<typeof tableSchema>;

const TABLE_TYPES = [
  'Standard',
  'Bar Seating',
  'Booth',
  'Sofa',
];

const TABLE_SHAPES = [
  'Rectangle',
  'Round',
  'Square',
  'Oval',
];

const PRIVACY_LEVELS = [
  { value: 'public', label: 'Public Area' },
  { value: 'semi-private', label: 'Semi-Private' },
  { value: 'private', label: 'Private' },
  { value: 'vip', label: 'VIP Private' }
];

const AMBIANCE_OPTIONS = [
  { value: 'casual', label: 'Casual Dining' },
  { value: 'upscale', label: 'Upscale/Fine Dining' },
  { value: 'romantic', label: 'Romantic Setting' },
  { value: 'business', label: 'Business/Professional' }
];

interface TableManagementFormProps {
  initialData?: any;
  onSubmit: (data: TableFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const TableManagementForm: React.FC<TableManagementFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<TableFormData>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      table_number: initialData?.table_number || 1,
      seats: initialData?.seats || 4,
      type: initialData?.type || 'Standard',
      shape: initialData?.shape || 'Rectangle',
      accessibility_friendly: initialData?.accessibility_friendly || false,
      description: initialData?.description || '',
      can_combine: initialData?.can_combine || false,
      // Enhanced features
      vip_status: initialData?.vip_status || false,
      window_seating: initialData?.window_seating || false,
      privacy_level: initialData?.privacy_level || 'public',
      ambiance: initialData?.ambiance || 'casual',
      is_high_top: initialData?.is_high_top || false,
      is_outdoor: initialData?.is_outdoor || false,
      is_quiet_area: initialData?.is_quiet_area || false,
      is_main_dining: initialData?.is_main_dining || false,
      is_family_friendly: initialData?.is_family_friendly ?? true,
      is_business_friendly: initialData?.is_business_friendly || false,
      service_status: initialData?.service_status || 'available',
    },
  });

  const handleFormSubmit = (data: TableFormData) => {
    // Auto-generate table name if not editing existing table
    const formDataWithName = {
      ...data,
      table_name: initialData?.table_name || `T${data.table_number}`
    };
    onSubmit(formDataWithName);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Essential Details */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="table_number">Table Number *</Label>
            <Input
              id="table_number"
              type="number"
              {...register('table_number', { valueAsNumber: true })}
              className="mt-1"
            />
            {errors.table_number && (
              <p className="text-destructive text-sm mt-1">{errors.table_number.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="seats">Number of Seats *</Label>
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="type">Table Type</Label>
            <Select 
              value={watch('type') || 'Standard'} 
              onValueChange={(value) => {
                setValue('type', value);
                // Auto-set related checkboxes based on table type
                if (value === 'Bar Seating') {
                  setValue('is_high_top', true);
                }
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select table type" />
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

          <div>
            <Label htmlFor="shape">Table Shape</Label>
            <Select 
              value={watch('shape') || 'Rectangle'} 
              onValueChange={(value) => setValue('shape', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select table shape" />
              </SelectTrigger>
              <SelectContent>
                {TABLE_SHAPES.map((shape) => (
                  <SelectItem key={shape} value={shape}>
                    {shape}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!initialData && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            Table name will be auto-generated as "T{watch('table_number') || '1'}"
          </div>
        )}

        {/* Essential Options */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_combine"
              checked={watch('can_combine')}
              onCheckedChange={(checked) => setValue('can_combine', !!checked)}
            />
            <Label htmlFor="can_combine" className="text-sm font-medium">
              Can Combine with Other Tables
            </Label>
          </div>
          
          {watch('can_combine') && (
            <p className="text-sm text-muted-foreground ml-6">
              This table can be combined with others in Table Groups. Configure group settings and table priority in the Table Groups tab.
            </p>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="accessibility_friendly"
              checked={watch('accessibility_friendly')}
              onCheckedChange={(checked) => setValue('accessibility_friendly', !!checked)}
            />
            <Label htmlFor="accessibility_friendly" className="text-sm font-medium">
              Wheelchair/Accessibility Friendly
            </Label>
          </div>
        </div>

        {/* Service Status Section */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Table Service Status</h4>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="service_available" className="text-sm font-medium">
                  Available for Service
                </Label>
                {watch('service_status') !== 'available' && (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <Switch
                id="service_available"
                checked={watch('service_status') === 'available'}
                onCheckedChange={(checked) => {
                  setValue('service_status', checked ? 'available' : 'out_of_service');
                }}
              />
            </div>
            
            {watch('service_status') !== 'available' && (
              <div className="ml-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="out_of_service"
                    name="service_status"
                    checked={watch('service_status') === 'out_of_service'}
                    onChange={() => setValue('service_status', 'out_of_service')}
                    className="h-4 w-4 text-primary"
                  />
                  <Label htmlFor="out_of_service" className="text-sm">
                    Out of Service
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Table is physically present but not available for reservations. Breaks table group combinations.
                </p>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="temporarily_removed"
                    name="service_status"
                    checked={watch('service_status') === 'temporarily_removed'}
                    onChange={() => setValue('service_status', 'temporarily_removed')}
                    className="h-4 w-4 text-primary"
                  />
                  <Label htmlFor="temporarily_removed" className="text-sm">
                    Temporarily Removed
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Table is physically removed. Other tables in group can still be combined.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Features Section */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
          >
            <span>Advanced Features</span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-4">
          {/* Location & Environment */}
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">Location & Environment</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_main_dining"
                  checked={watch("is_main_dining")}
                  onCheckedChange={(checked) => setValue("is_main_dining", !!checked)}
                />
                <Label htmlFor="is_main_dining" className="text-sm">Main Dining</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_outdoor"
                  checked={watch("is_outdoor")}
                  onCheckedChange={(checked) => setValue("is_outdoor", !!checked)}
                />
                <Label htmlFor="is_outdoor" className="text-sm">Outdoor/Terrace</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_quiet_area"
                  checked={watch("is_quiet_area")}
                  onCheckedChange={(checked) => setValue("is_quiet_area", !!checked)}
                />
                <Label htmlFor="is_quiet_area" className="text-sm">Quiet Area</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="window_seating"
                  checked={watch("window_seating")}
                  onCheckedChange={(checked) => setValue("window_seating", !!checked)}
                />
                <Label htmlFor="window_seating" className="text-sm">Window Seating</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Premium Features */}
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">Premium Features</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vip_status"
                  checked={watch("vip_status")}
                  onCheckedChange={(checked) => setValue("vip_status", !!checked)}
                />
                <Label htmlFor="vip_status" className="text-sm">VIP/Premium Table</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Table Characteristics */}
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">Table Characteristics</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_high_top"
                  checked={watch("is_high_top")}
                  onCheckedChange={(checked) => setValue("is_high_top", !!checked)}
                />
                <Label htmlFor="is_high_top" className="text-sm">High Top/Bar Table</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Atmosphere & Suitability */}
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">Atmosphere & Suitability</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_family_friendly"
                  checked={watch("is_family_friendly")}
                  onCheckedChange={(checked) => setValue("is_family_friendly", !!checked)}
                />
                <Label htmlFor="is_family_friendly" className="text-sm">Family Friendly</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_business_friendly"
                  checked={watch("is_business_friendly")}
                  onCheckedChange={(checked) => setValue("is_business_friendly", !!checked)}
                />
                <Label htmlFor="is_business_friendly" className="text-sm">Business Meetings</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Privacy & Ambiance Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="privacy_level">Privacy Level</Label>
              <Select value={watch("privacy_level")} onValueChange={(value) => setValue("privacy_level", value as 'public' | 'semi-private' | 'private' | 'vip')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select privacy level" />
                </SelectTrigger>
                <SelectContent>
                  {PRIVACY_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="ambiance">Ambiance Style</Label>
              <Select value={watch("ambiance")} onValueChange={(value) => setValue("ambiance", value as 'casual' | 'upscale' | 'romantic' | 'business')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select ambiance style" />
                </SelectTrigger>
                <SelectContent>
                  {AMBIANCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description/Notes */}
          <div>
            <Label htmlFor="description">Description/Notes</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Additional details about this table..."
              className="mt-1"
              rows={3}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Form Actions */}
      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {initialData ? 'Updating...' : 'Adding...'}
            </>
          ) : (
            initialData ? 'Update Table' : 'Add Table'
          )}
        </Button>
      </div>
    </form>
  );
};