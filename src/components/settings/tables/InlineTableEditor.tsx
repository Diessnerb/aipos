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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { X, Save, Settings2, Star, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
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
  privacy_level: z.enum(['public', 'semi-private', 'private', 'vip']).optional(),
  ambiance: z.enum(['casual', 'upscale', 'romantic', 'business']).optional(),
  is_high_top: z.boolean().default(false),
  is_main_dining: z.boolean().default(false),
  is_outdoor: z.boolean().default(false),
  is_quiet_area: z.boolean().default(false),
  is_family_friendly: z.boolean().default(false),
  is_business_friendly: z.boolean().default(false),
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

interface InlineTableEditorProps {
  table: Table;
  onSave: (data: TableFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const InlineTableEditor: React.FC<InlineTableEditorProps> = ({
  table,
  onSave,
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
      table_number: table.table_number,
      table_name: table.table_name || '',
      seats: table.seats,
      type: table.type || '',
      shape: table.shape || '',
      accessibility_friendly: table.accessibility_friendly || false,
      description: table.description || '',
      can_combine: table.can_combine ?? false,
      // Advanced features
      vip_status: table.vip_status || false,
      window_seating: table.window_seating || false,
      privacy_level: table.privacy_level as 'public' | 'semi-private' | 'private' | 'vip' | undefined,
      ambiance: table.ambiance as 'casual' | 'upscale' | 'romantic' | 'business' | undefined,
      is_high_top: table.is_high_top || false,
      is_main_dining: table.is_main_dining || false,
      is_outdoor: table.is_outdoor || false,
      is_quiet_area: table.is_quiet_area || false,
      is_family_friendly: table.is_family_friendly || false,
      is_business_friendly: table.is_business_friendly || false,
      service_status: table.service_status || 'available',
    },
  });

  const accessibilityFriendly = watch('accessibility_friendly');
  const canCombine = watch('can_combine');
  const currentType = watch('type');
  const currentShape = watch('shape');
  const currentPrivacyLevel = watch('privacy_level');
  const currentAmbiance = watch('ambiance');

  // Watch advanced features
  const vipStatus = watch('vip_status');
  const windowSeating = watch('window_seating');
  const isHighTop = watch('is_high_top');
  const isMainDining = watch('is_main_dining');
  const isOutdoor = watch('is_outdoor');
  const isQuietArea = watch('is_quiet_area');
  const isFamilyFriendly = watch('is_family_friendly');
  const isBusinessFriendly = watch('is_business_friendly');

  // Set initial values for selects
  React.useEffect(() => {
    if (table.type) setValue('type', table.type);
    if (table.shape) setValue('shape', table.shape);
    if (table.privacy_level) setValue('privacy_level', table.privacy_level as 'public' | 'semi-private' | 'private' | 'vip');
    if (table.ambiance) setValue('ambiance', table.ambiance as 'casual' | 'upscale' | 'romantic' | 'business');
    if (table.is_main_dining) setValue('is_main_dining', table.is_main_dining);
  }, [table, setValue]);

  return (
    <div className="border-t bg-muted/30 p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-primary">Edit Table {table.table_number}</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSave)} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <Label htmlFor="table_name">Table Name</Label>
            <Input
              id="table_name"
              {...register('table_name')}
              placeholder="e.g., Window Table"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="seats">Seats *</Label>
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

        {/* Table Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="type">Table Type</Label>
            <Select value={currentType} onValueChange={(value) => {
              setValue('type', value);
              // Auto-set related checkboxes based on table type
              if (value === 'Bar Seating') {
                setValue('is_high_top', true);
              }
            }}>
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
            <Select value={currentShape} onValueChange={(value) => setValue('shape', value)}>
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


        {/* Accessibility and Description */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="accessibility_friendly"
              checked={accessibilityFriendly}
              onCheckedChange={(checked) => setValue('accessibility_friendly', !!checked)}
            />
            <Label htmlFor="accessibility_friendly" className="text-sm font-medium">
              Wheelchair/Accessibility Friendly
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_combine"
              {...register('can_combine')}
              checked={canCombine}
              onCheckedChange={(checked) => setValue('can_combine', !!checked)}
            />
            <Label htmlFor="can_combine" className="text-sm font-medium">
              Can this table combine with others
            </Label>
          </div>

          <div>
            <Label htmlFor="description">Description/Notes</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Additional details about this table..."
              className="mt-1"
              rows={2}
            />
          </div>
        </div>

        {/* Service Status Section */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
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

        {/* Advanced Features Section - Collapsible */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-between p-3 h-auto border rounded-lg hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Advanced Features</span>
                 <Badge variant="secondary" className="text-xs">
                   {[
                     vipStatus,
                     windowSeating,
                     isHighTop,
                     isMainDining,
                     isOutdoor,
                     isQuietArea,
                     isFamilyFriendly,
                     isBusinessFriendly,
                     currentPrivacyLevel,
                     currentAmbiance
                   ].filter(Boolean).length} selected
                 </Badge>
              </div>
              {showAdvanced ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-6 pt-4">
            <div className="border rounded-lg p-6 bg-card space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="vip_status"
                      checked={vipStatus}
                      onCheckedChange={(checked) => setValue("vip_status", !!checked)}
                    />
                    <Label htmlFor="vip_status">VIP Table</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_high_top"
                      checked={isHighTop}
                      onCheckedChange={(checked) => setValue("is_high_top", !!checked)}
                    />
                    <Label htmlFor="is_high_top">High Top Table</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="privacy_level">Privacy Level</Label>
                    <Select
                      value={currentPrivacyLevel || ""}
                      onValueChange={(value) => setValue("privacy_level", value as 'public' | 'semi-private' | 'private' | 'vip')}
                    >
                      <SelectTrigger>
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

                  <div className="space-y-2">
                    <Label htmlFor="ambiance">Ambiance</Label>
                    <Select
                      value={currentAmbiance || ""}
                      onValueChange={(value) => setValue("ambiance", value as 'casual' | 'upscale' | 'romantic' | 'business')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select ambiance" />
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

                <div className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Location & Environment</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="is_main_dining"
                          checked={isMainDining || false}
                          onCheckedChange={(checked) => setValue("is_main_dining", !!checked)}
                        />
                        <Label htmlFor="is_main_dining" className="text-sm">Main Dining</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="is_outdoor"
                          checked={isOutdoor || false}
                          onCheckedChange={(checked) => setValue("is_outdoor", !!checked)}
                        />
                        <Label htmlFor="is_outdoor" className="text-sm">Outdoor/Terrace</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="is_quiet_area"
                          checked={isQuietArea || false}
                          onCheckedChange={(checked) => setValue("is_quiet_area", !!checked)}
                        />
                        <Label htmlFor="is_quiet_area" className="text-sm">Quiet Area</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="window_seating"
                          checked={windowSeating || false}
                          onCheckedChange={(checked) => setValue("window_seating", !!checked)}
                        />
                        <Label htmlFor="window_seating" className="text-sm">Window Seating</Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Suitability</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="is_family_friendly"
                          checked={isFamilyFriendly || false}
                          onCheckedChange={(checked) => setValue("is_family_friendly", !!checked)}
                        />
                        <Label htmlFor="is_family_friendly" className="text-sm">Family Friendly</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="is_business_friendly"
                          checked={isBusinessFriendly || false}
                          onCheckedChange={(checked) => setValue("is_business_friendly", !!checked)}
                        />
                        <Label htmlFor="is_business_friendly" className="text-sm">Business Friendly</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

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
              onCheckedChange={(checked) => setValue('can_combine', !!checked)}
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

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
};