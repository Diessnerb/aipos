import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useIngredients } from '@/hooks/useIngredients';
import { PORTION_TYPES } from '@/types/ingredients';
import { ALLERGEN_LIST } from '@/utils/allergens';
import { Separator } from '@/components/ui/separator';
import { areUnitsCompatible, getUnitSystem } from '@/lib/unitConversions';
import { calculateCostPerPortion, formatCostDisplay } from '@/lib/costCalculations';
import { SupplierSelector } from '@/components/delivery/SupplierSelector';
import type { Supplier } from '@/types/delivery-db';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sale_price: z.coerce.number().min(0, 'Sale price must be positive'),
  portion_size: z.coerce.number().min(0.001, 'Portion size must be greater than 0'),
  portion_type: z.string().min(1, 'Portion type is required'),
  description: z.string().optional(),
  supplier: z.string().optional(),
  supplier_id: z.string().optional(),
  purchase_size: z.coerce.number().min(0).optional().or(z.literal('')),
  purchase_type: z.string().optional(),
  purchase_price: z.coerce.number().min(0).optional().or(z.literal('')),
  known_as: z.string().optional(),
  units_per_purchase: z.coerce.number().min(1).optional().or(z.literal('')),
  allergens: z.array(z.string()).default([]),
  stock_level: z.coerce.number().min(0).optional().or(z.literal('')),
  stock_unit: z.string().optional(),
}).superRefine((data, ctx) => {
  // Validate unit compatibility when both purchase and portion types are set
  if (data.purchase_type && data.portion_type) {
    const purchaseSystem = getUnitSystem(data.purchase_type);
    const portionSystem = getUnitSystem(data.portion_type);
    
    // Allow weight/volume → Individual (this is what units_per_purchase is for)
    const isWeightOrVolumeToIndividual = 
      (purchaseSystem === 'weight' || purchaseSystem === 'volume') && 
      portionSystem === 'individual';
    
    // Check compatibility unless it's the special case
    if (!isWeightOrVolumeToIndividual && !areUnitsCompatible(data.purchase_type, data.portion_type)) {
      const msg = `Purchase unit (${data.purchase_type}) and Portion unit (${data.portion_type}) must be compatible. You cannot serve weight/volume portions from Individual purchases.`;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: msg,
        path: ['purchase_type'],
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: msg,
        path: ['portion_type'],
      });
    }
    
    // Suggest using units_per_purchase for weight/volume → Individual
    if (isWeightOrVolumeToIndividual && !data.units_per_purchase) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Consider adding "Units per Purchase" to track how many Individual portions are in ${data.purchase_size || ''} ${data.purchase_type}`,
        path: ['units_per_purchase'],
      });
    }
  }
  
  // Validate stock_unit compatibility with portion_type
  if (data.stock_unit && data.portion_type) {
    const stockSystem = getUnitSystem(data.stock_unit);
    const portionSystem = getUnitSystem(data.portion_type);
    
    // Allow weight/volume → Individual for stock as well
    const isWeightOrVolumeToIndividual = 
      (stockSystem === 'weight' || stockSystem === 'volume') && 
      portionSystem === 'individual';
    
    if (!isWeightOrVolumeToIndividual && !areUnitsCompatible(data.stock_unit, data.portion_type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Stock unit must be compatible with portion unit`,
        path: ['stock_unit'],
      });
    }
  }
});

type FormValues = z.infer<typeof formSchema>;

interface AddIngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddIngredientModal = ({ isOpen, onClose }: AddIngredientModalProps) => {
  const { createIngredient } = useIngredients();
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      sale_price: 0,
      portion_size: 1,
      portion_type: 'g',
      description: '',
      supplier: '',
      supplier_id: '',
      purchase_size: '',
      purchase_type: '',
      purchase_price: '',
      known_as: '',
      units_per_purchase: '',
      allergens: [],
      stock_level: '',
      stock_unit: 'kg',
    },
  });

  const onSubmit = async (data: FormValues) => {
    // Calculate cost_price before saving
    const calculatedCostPrice = calculateCostPerPortion({
      purchasePrice: data.purchase_price ? Number(data.purchase_price) : null,
      purchaseSize: data.purchase_size ? Number(data.purchase_size) : null,
      purchaseType: data.purchase_type || null,
      portionSize: data.portion_size,
      portionType: data.portion_type,
      unitsPerPurchase: data.units_per_purchase ? Number(data.units_per_purchase) : null,
    });

    const ingredientData = {
      company_id: '', // Will be set by the hook
      name: data.name,
      sale_price: Number(data.sale_price),
      portion_size: Number(data.portion_size),
      portion_type: data.portion_type,
      description: data.description || null,
      cost_price: calculatedCostPrice,
      supplier: selectedSupplier?.name || data.supplier || null,
      supplier_id: data.supplier_id || null,
      purchase_size: data.purchase_size ? Number(data.purchase_size) : null,
      purchase_type: data.purchase_type || null,
      purchase_price: data.purchase_price ? Number(data.purchase_price) : null,
      known_as: data.known_as || null,
      units_per_purchase: data.units_per_purchase ? Number(data.units_per_purchase) : null,
      allergens: data.allergens || [],
      stock_level: data.stock_level ? Number(data.stock_level) : null,
      stock_unit: data.stock_unit || null,
      last_stock_update: data.stock_level ? new Date().toISOString() : null,
    };

    await createIngredient.mutateAsync(ingredientData);
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Ingredient</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Mozzarella Cheese" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Optional description..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Cost & Measurement Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Cost & Measurement Information</h3>
              
              {/* Pricing */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground">💰 Pricing</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sale_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sale Price *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Calculated Cost Price Display */}
                  <div className="space-y-2">
                    <FormLabel>Cost Per Portion (Calculated)</FormLabel>
                    <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted/50 flex items-center text-sm">
                      {(() => {
                        const calculatedCost = calculateCostPerPortion({
                          purchasePrice: form.watch('purchase_price') ? Number(form.watch('purchase_price')) : null,
                          purchaseSize: form.watch('purchase_size') ? Number(form.watch('purchase_size')) : null,
                          purchaseType: form.watch('purchase_type') || null,
                          portionSize: form.watch('portion_size'),
                          portionType: form.watch('portion_type'),
                          unitsPerPurchase: form.watch('units_per_purchase') ? Number(form.watch('units_per_purchase')) : null,
                        });
                        
                        if (calculatedCost === null) {
                          return (
                            <span className="text-muted-foreground text-xs">
                              Fill purchase details to calculate
                            </span>
                          );
                        }
                        
                        return (
                          <span className="font-medium">
                            {formatCostDisplay(calculatedCost)}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      💡 Automatically calculated from purchase price and portion size
                    </p>
                  </div>
                </div>
              </div>

              {/* What You Serve */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground">🍽️ What You Serve</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="portion_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Portion Size *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.001" placeholder="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="portion_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Portion Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PORTION_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* What You Buy */}
              <div className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground">📦 What You Buy</h4>
                
                <FormField
                  control={form.control}
                  name="supplier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <FormControl>
                        <SupplierSelector
                          value={field.value}
                          onSelect={(supplier) => {
                            field.onChange(supplier.id);
                            setSelectedSupplier(supplier);
                            form.setValue('supplier', supplier.name);
                          }}
                          placeholder="Search suppliers..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="purchase_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Size</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.001" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchase_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PORTION_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchase_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="known_as"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Known As</FormLabel>
                        <FormControl>
                          <Input placeholder='e.g., "1 tin"' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Conditional Units Per Purchase */}
                {form.watch('portion_type') === 'Individual' && 
                 form.watch('purchase_type') && 
                 form.watch('purchase_type') !== 'Individual' && (
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="units_per_purchase"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Units per Purchase</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="1" 
                              placeholder="e.g., 25 rashers per 1kg" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      💡 How many {form.watch('portion_type')} portions are in {form.watch('purchase_size') || 1} {form.watch('purchase_type')}?
                      <br />
                      Example: 1kg bacon with 25 rashers → enter 25
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Initial Stock Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Initial Stock (Optional)</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="stock_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Level</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="stock_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Unit</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PORTION_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Allergens Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Allergens</h3>
                <p className="text-xs text-muted-foreground">
                  Select all allergens present in this ingredient
                </p>
              </div>
              
              <FormField
                control={form.control}
                name="allergens"
                render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-2 gap-3">
                      {ALLERGEN_LIST.map((allergen) => (
                        <div key={allergen} className="flex items-center space-x-2">
                          <Checkbox
                            id={`add-${allergen}`}
                            checked={field.value?.includes(allergen)}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              const updated = checked
                                ? [...current, allergen]
                                : current.filter((a) => a !== allergen);
                              field.onChange(updated);
                            }}
                          />
                          <label
                            htmlFor={`add-${allergen}`}
                            className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {allergen}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createIngredient.isPending}>
                {createIngredient.isPending ? 'Adding...' : 'Add Ingredient'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
