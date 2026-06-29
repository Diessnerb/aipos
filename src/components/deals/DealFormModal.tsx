import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator, SelectLabel, SelectGroup } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreateDealData, Deal } from '@/hooks/useDeals';
import { useDealTypes } from '@/hooks/useDealTypes';
import { useMenuCategories } from '@/hooks/useMenuCategories';
import { useMenuItems } from '@/hooks/useMenuItems';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { TimeSelectionModal } from '@/components/reservations/TimeSelectionModal';
import { Plus, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday to Sunday for display

// Built-in deal types for backward compatibility
const BUILTIN_DEAL_TYPES = [
  { key: 'percentage_off', name: 'Percentage Off' },
  { key: 'amount_off', name: 'Amount Off' },
  { key: 'set_price', name: 'Set Price' },
  { key: 'n_for_m', name: 'Multi-buy Deal' },
  { key: 'bogo', name: 'Buy One Get One' },
  { key: 'note', name: 'Special Note' }
];

interface DealFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Partial<Deal> | null;
  onSubmit: (data: CreateDealData) => void;
}

export const DealFormModal: React.FC<DealFormModalProps> = ({
  open,
  onOpenChange,
  deal,
  onSubmit
}) => {
  const { toast } = useToast();
  const { dealTypes, loading: dealTypesLoading } = useDealTypes();
  const { categories } = useMenuCategories();
  const { menuItems } = useMenuItems();
  const [formData, setFormData] = useState<CreateDealData>({
    day_of_week: [],
    deal_name: '',
    description: '',
    deal_type: 'percentage_off',
    discount_value: 0,
    n_value: 3,
    m_value: 2,
    start_time: '00:00',
    end_time: '23:59',
    is_active: true,
    applies_to: 'all',
    custom_fields: {}
  });
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    deal_name: boolean;
    deal_type: boolean;
    categories: boolean;
    items: boolean;
  }>({ deal_name: false, deal_type: false, categories: false, items: false });

  // Find the selected deal type schema
  const selectedDealType = dealTypes.find(dt => dt.key === formData.deal_type);
  const isBuiltinType = BUILTIN_DEAL_TYPES.some(bt => bt.key === formData.deal_type);

  useEffect(() => {
    if (deal && 'id' in deal && deal.id) {
      // Editing existing deal - load all fields from deal
      setFormData({
        day_of_week: deal.day_of_week || [],
        deal_name: deal.deal_name || '',
        description: deal.description || '',
        deal_type: deal.deal_type || 'percentage_off',
        discount_value: deal.discount_value || 0,
        n_value: deal.n_value || 3,
        m_value: deal.m_value || 2,
        start_time: deal.start_time || '00:00',
        end_time: deal.end_time || '23:59',
        is_active: deal.is_active ?? true,
        applies_to: deal.applies_to || 'all',
        menu_category_ids: deal.menu_category_ids || [],
        menu_item_ids: deal.menu_item_ids || [],
        custom_fields: deal.custom_fields || {}
      });
    } else {
      // Creating new deal - use defaults but honor day_of_week if provided
      setFormData({
        day_of_week: deal?.day_of_week || [],
        deal_name: '',
        description: '',
        deal_type: 'percentage_off',
        discount_value: 0,
        n_value: 3,
        m_value: 2,
        start_time: '00:00',
        end_time: '23:59',
        is_active: true,
        applies_to: 'all',
        custom_fields: {}
      });
    }
  }, [deal, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const errors = {
      deal_name: !formData.deal_name.trim(),
      deal_type: !formData.deal_type || formData.deal_type === '',
      categories: formData.applies_to === 'categories' && (!formData.menu_category_ids || formData.menu_category_ids.length === 0),
      items: formData.applies_to === 'items' && (!formData.menu_item_ids || formData.menu_item_ids.length === 0)
    };
    
    setValidationErrors(errors);
    
    // If any errors, show toast and prevent submission
    if (errors.deal_name || errors.deal_type) {
      toast({
        title: "You missed a couple of things",
        variant: "destructive"
      });
      return;
    }

    if (errors.categories) {
      toast({
        title: "Please select at least one category",
        variant: "destructive"
      });
      return;
    }

    if (errors.items) {
      toast({
        title: "Please select at least one menu item",
        variant: "destructive"
      });
      return;
    }

    // Validate at least one day is selected
    if (formData.day_of_week.length === 0) {
      toast({
        title: "Please select at least one day",
        variant: "destructive"
      });
      return;
    }
    
    onSubmit(formData);
  };

  const handleInputChange = (field: keyof CreateDealData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field when user starts fixing it
    if (field === 'deal_name' && validationErrors.deal_name) {
      setValidationErrors(prev => ({ ...prev, deal_name: false }));
    }
  };

  const handleCustomFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: {
        ...prev.custom_fields,
        [fieldName]: value
      }
    }));
  };

  const handleDealTypeChange = (value: string) => {
    // Clear custom fields when changing deal types
    setFormData(prev => ({
      ...prev,
      deal_type: value,
      custom_fields: {}
    }));
    
    // Clear validation error when user selects a deal type
    if (validationErrors.deal_type) {
      setValidationErrors(prev => ({ ...prev, deal_type: false }));
    }
  };

  const renderDealSpecificFields = () => {
    // Render built-in fields for backward compatibility
    if (isBuiltinType) {
      switch (formData.deal_type) {
        case 'percentage_off':
          return (
            <div className="space-y-2">
              <Label htmlFor="discount_value">Percentage Off</Label>
              <Input
                id="discount_value"
                type="number"
                min="0"
                max="100"
                value={formData.discount_value || ''}
                onChange={(e) => handleInputChange('discount_value', parseFloat(e.target.value) || 0)}
                placeholder="e.g., 20"
              />
            </div>
          );
        case 'amount_off':
          return (
            <div className="space-y-2">
              <Label htmlFor="discount_value">Amount Off (£)</Label>
              <Input
                id="discount_value"
                type="number"
                min="0"
                step="0.01"
                value={formData.discount_value || ''}
                onChange={(e) => handleInputChange('discount_value', parseFloat(e.target.value) || 0)}
                placeholder="e.g., 5.00"
              />
            </div>
          );
        case 'set_price':
          return (
            <div className="space-y-2">
              <Label htmlFor="discount_value">Set Price (£)</Label>
              <Input
                id="discount_value"
                type="number"
                min="0"
                step="0.01"
                value={formData.discount_value || ''}
                onChange={(e) => handleInputChange('discount_value', parseFloat(e.target.value) || 0)}
                placeholder="e.g., 10.00"
              />
            </div>
          );
        case 'n_for_m':
          return (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="n_value">Buy Quantity</Label>
                <Input
                  id="n_value"
                  type="number"
                  min="1"
                  value={formData.n_value || ''}
                  onChange={(e) => handleInputChange('n_value', parseInt(e.target.value) || 3)}
                  placeholder="3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m_value">Pay For</Label>
                <Input
                  id="m_value"
                  type="number"
                  min="1"
                  value={formData.m_value || ''}
                  onChange={(e) => handleInputChange('m_value', parseInt(e.target.value) || 2)}
                  placeholder="2"
                />
              </div>
            </div>
          );
        case 'note':
          return (
            <div className="space-y-2">
              <Label htmlFor="note_text">Deal Details</Label>
              <Textarea
                id="note_text"
                value={formData.custom_fields?.note_text || ''}
                onChange={(e) => handleCustomFieldChange('note_text', e.target.value)}
                placeholder="Describe the deal details..."
                rows={3}
              />
            </div>
          );
        case 'bogo':
          return (
            <div className="text-sm text-muted-foreground">
              Buy One Get One - No additional configuration needed.
            </div>
          );
        default:
          return null;
      }
    }

    // Render custom fields for dynamic deal types
    if (selectedDealType && selectedDealType.schema.fields.length > 0) {
      return (
        <div className="space-y-4">
          <Label className="text-base font-medium">Deal Configuration</Label>
          {selectedDealType.schema.fields.map((field) => (
            <DynamicFieldRenderer
              key={field.name}
              field={field}
              value={formData.custom_fields?.[field.name]}
              onChange={(value) => handleCustomFieldChange(field.name, value)}
            />
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {deal?.id ? 'Edit Deal' : 'Create New Deal'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Days of Week *</Label>
            <div className="space-y-3 p-4 border rounded-md">
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleInputChange('day_of_week', [0, 1, 2, 3, 4, 5, 6])}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleInputChange('day_of_week', [])}
                >
                  Clear All
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 1, label: 'Monday' },
                  { value: 2, label: 'Tuesday' },
                  { value: 3, label: 'Wednesday' },
                  { value: 4, label: 'Thursday' },
                  { value: 5, label: 'Friday' },
                  { value: 6, label: 'Saturday' },
                  { value: 0, label: 'Sunday' },
                ].map((day) => (
                  <div key={day.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`day-${day.value}`}
                      checked={formData.day_of_week.includes(day.value)}
                      onChange={(e) => {
                        const currentDays = formData.day_of_week;
                        const newDays = e.target.checked
                          ? [...currentDays, day.value]
                          : currentDays.filter(d => d !== day.value);
                        handleInputChange('day_of_week', newDays);
                      }}
                      className="w-4 h-4"
                    />
                    <Label
                      htmlFor={`day-${day.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
              <Label htmlFor="deal_type">Deal Type</Label>
              <Select value={formData.deal_type} onValueChange={handleDealTypeChange}>
                <SelectTrigger className={validationErrors.deal_type ? 'border-red-500 focus:ring-red-500' : ''}>
                  <SelectValue placeholder="Select deal type" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  {/* Built-in deal types */}
                  <SelectGroup>
                    <SelectLabel>Built-in Types</SelectLabel>
                    {BUILTIN_DEAL_TYPES.map((type) => (
                      <SelectItem key={type.key} value={type.key}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  
                  {/* Custom deal types */}
                  {dealTypes.filter(dt => !dt.is_builtin).length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Custom Types</SelectLabel>
                        {dealTypes
                          .filter(dt => !dt.is_builtin)
                          .map((type) => (
                            <SelectItem key={type.key} value={type.key}>
                              {type.name}
                            </SelectItem>
                          ))
                        }
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal_name">Deal Name</Label>
            <Input
              id="deal_name"
              value={formData.deal_name}
              onChange={(e) => handleInputChange('deal_name', e.target.value)}
              placeholder="e.g., Tuesday Curry Night"
              required
              className={validationErrors.deal_name ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe your deal..."
              rows={3}
            />
          </div>

          {/* Applies To Section */}
          <div className="space-y-3">
            <Label>Applies To</Label>
            <RadioGroup
              value={formData.applies_to || 'all'}
              onValueChange={(value: 'all' | 'categories' | 'items') => {
                setFormData(prev => ({
                  ...prev,
                  applies_to: value,
                  menu_category_ids: value === 'all' ? [] : prev.menu_category_ids,
                  menu_item_ids: value === 'all' ? [] : prev.menu_item_ids
                }));
                setValidationErrors(prev => ({ ...prev, categories: false, items: false }));
              }}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="applies-all" />
                <Label htmlFor="applies-all" className="font-normal cursor-pointer">
                  All Menu Items
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="categories" id="applies-categories" />
                <Label htmlFor="applies-categories" className="font-normal cursor-pointer">
                  Specific Categories
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="items" id="applies-items" />
                <Label htmlFor="applies-items" className="font-normal cursor-pointer">
                  Specific Items
                </Label>
              </div>
            </RadioGroup>

            {/* Category Selection */}
            {formData.applies_to === 'categories' && (
              <div className="space-y-2 p-4 border rounded-md">
                <Label className={validationErrors.categories ? 'text-red-500' : ''}>
                  Select Categories *
                </Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {categories.map((category) => (
                    <div key={category.id}>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`cat-${category.id}`}
                          checked={formData.menu_category_ids?.includes(category.id)}
                          onCheckedChange={(checked) => {
                            const currentIds = formData.menu_category_ids || [];
                            const newIds = checked
                              ? [...currentIds, category.id]
                              : currentIds.filter(id => id !== category.id);
                            handleInputChange('menu_category_ids', newIds);
                            setValidationErrors(prev => ({ ...prev, categories: false }));
                          }}
                        />
                        <Label
                          htmlFor={`cat-${category.id}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {category.name}
                          {category.category_type && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({category.category_type})
                            </span>
                          )}
                        </Label>
                      </div>
                      {/* Subcategories */}
                      {category.subcategories && category.subcategories.length > 0 && (
                        <div className="ml-6 mt-1 space-y-1">
                          {category.subcategories.map((subcat) => (
                            <div key={subcat.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`cat-${subcat.id}`}
                                checked={formData.menu_category_ids?.includes(subcat.id)}
                                onCheckedChange={(checked) => {
                                  const currentIds = formData.menu_category_ids || [];
                                  const newIds = checked
                                    ? [...currentIds, subcat.id]
                                    : currentIds.filter(id => id !== subcat.id);
                                  handleInputChange('menu_category_ids', newIds);
                                  setValidationErrors(prev => ({ ...prev, categories: false }));
                                }}
                              />
                              <Label
                                htmlFor={`cat-${subcat.id}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {subcat.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Item Selection */}
            {formData.applies_to === 'items' && (
              <div className="space-y-2 p-4 border rounded-md">
                <Label className={validationErrors.items ? 'text-red-500' : ''}>
                  Select Menu Items *
                </Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {menuItems && menuItems.length > 0 ? (
                    menuItems.map((item) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`item-${item.id}`}
                          checked={formData.menu_item_ids?.includes(item.id)}
                          onCheckedChange={(checked) => {
                            const currentIds = formData.menu_item_ids || [];
                            const newIds = checked
                              ? [...currentIds, item.id]
                              : currentIds.filter(id => id !== item.id);
                            handleInputChange('menu_item_ids', newIds);
                            setValidationErrors(prev => ({ ...prev, items: false }));
                          }}
                        />
                        <Label
                          htmlFor={`item-${item.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {item.name}
                          {item.price && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              £{item.price.toFixed(2)}
                            </span>
                          )}
                        </Label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No menu items available</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {renderDealSpecificFields()}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowStartTimeModal(true)}
                className="w-full justify-start text-left font-normal"
              >
                <Clock className="mr-2 h-4 w-4" />
                {formData.start_time}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">End Time</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEndTimeModal(true)}
                className="w-full justify-start text-left font-normal"
              >
                <Clock className="mr-2 h-4 w-4" />
                {formData.end_time}
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange('is_active', checked)}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {deal?.id ? 'Update Deal' : 'Create Deal'}
            </Button>
          </div>
        </form>
      </DialogContent>
      
      <TimeSelectionModal
        isOpen={showStartTimeModal}
        onClose={() => setShowStartTimeModal(false)}
        onTimeSelect={(time) => handleInputChange('start_time', time)}
        currentTime={formData.start_time}
      />
      
      <TimeSelectionModal
        isOpen={showEndTimeModal}
        onClose={() => setShowEndTimeModal(false)}
        onTimeSelect={(time) => handleInputChange('end_time', time)}
        currentTime={formData.end_time}
      />
    </Dialog>
  );
};