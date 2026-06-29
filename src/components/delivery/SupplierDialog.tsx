import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useAuth } from '@/components/AuthProvider';
import { useSupplierCategories } from '@/hooks/useSupplierCategories';
import { Plus, Check, X } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DeliveryScheduleBuilder } from './DeliveryScheduleBuilder';
import type { Supplier } from '@/types/delivery';

const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  contact_name: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  order_method: z.enum(['email', 'phone', 'online', 'print']),
  scheduling_mode: z.enum(['lead_time', 'fixed_schedule']),
  lead_time_days: z.number().min(0),
  minimum_order_value: z.number().min(0).optional(),
  notes: z.string().optional(),
  is_active: z.boolean(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
}

export const SupplierDialog: React.FC<SupplierDialogProps> = ({
  open,
  onOpenChange,
  supplier,
}) => {
  const { pinUser } = useAuth();
  const { createSupplier, updateSupplier } = useSuppliers();
  const { categories, createCategory } = useSupplierCategories();
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [schedulingMode, setSchedulingMode] = useState<'lead_time' | 'fixed_schedule'>('lead_time');
  
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      is_active: true,
      order_method: 'email',
      scheduling_mode: 'lead_time',
      lead_time_days: 2,
    },
  });

  useEffect(() => {
    if (supplier) {
      reset(supplier);
      setSelectedCategory(supplier.category);
      setSchedulingMode(supplier.scheduling_mode || 'lead_time');
    } else {
      reset({
        is_active: true,
        order_method: 'email',
        scheduling_mode: 'lead_time',
        lead_time_days: 2,
      });
      setSelectedCategory('');
      setSchedulingMode('lead_time');
    }
    setIsAddingCategory(false);
    setNewCategoryName('');
  }, [supplier, reset, open]);

  // Clear form when dialog closes
  useEffect(() => {
    if (!open) {
      reset({
        is_active: true,
        order_method: 'email',
        scheduling_mode: 'lead_time',
        lead_time_days: 2,
      });
      setSelectedCategory('');
      setSchedulingMode('lead_time');
    }
  }, [open, reset]);

  const onSubmit = (data: SupplierFormData) => {
    if (supplier) {
      updateSupplier({ id: supplier.id, updates: data });
    } else {
      createSupplier({ ...data, company_id: pinUser?.company_id! } as any);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {supplier ? 'Edit Supplier' : 'Add New Supplier'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Supplier Name *</Label>
              <Input id="name" {...register('name')} />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={selectedCategory}
                onValueChange={(value) => {
                  if (value === '__add_new__') {
                    setIsAddingCategory(true);
                  } else {
                    setSelectedCategory(value);
                    setValue('category', value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__add_new__" className="text-primary font-medium">
                    <Plus className="h-4 w-4 inline mr-2" />
                    Add Custom Category
                  </SelectItem>
                </SelectContent>
              </Select>

              {isAddingCategory && (
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Enter category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newCategoryName.trim()) {
                          const category = await createCategory(newCategoryName);
                          setSelectedCategory(category.name);
                          setValue('category', category.name);
                          setNewCategoryName('');
                          setIsAddingCategory(false);
                        }
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={async () => {
                      if (newCategoryName.trim()) {
                        const category = await createCategory(newCategoryName);
                        setSelectedCategory(category.name);
                        setValue('category', category.name);
                        setNewCategoryName('');
                        setIsAddingCategory(false);
                      }
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      setIsAddingCategory(false);
                      setNewCategoryName('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {errors.category && (
                <p className="text-sm text-destructive mt-1">{errors.category.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="order_method">Order Method *</Label>
              <select
                id="order_method"
                {...register('order_method')}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="online">Online</option>
                <option value="print">Print</option>
              </select>
            </div>

            <div>
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input id="contact_name" {...register('contact_name')} />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} />
            </div>

            <div className="col-span-2">
              <Label>Delivery Scheduling *</Label>
              <RadioGroup
                value={schedulingMode}
                onValueChange={(value: 'lead_time' | 'fixed_schedule') => {
                  setSchedulingMode(value);
                  setValue('scheduling_mode', value);
                }}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="lead_time" id="lead_time" />
                  <Label htmlFor="lead_time" className="font-normal cursor-pointer">
                    Lead Time (days)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed_schedule" id="fixed_schedule" />
                  <Label htmlFor="fixed_schedule" className="font-normal cursor-pointer">
                    Fixed Schedule (order/delivery days)
                  </Label>
                </div>
              </RadioGroup>

              {schedulingMode === 'lead_time' ? (
                <div className="mt-3">
                  <Input
                    type="number"
                    placeholder="e.g., 2 days"
                    {...register('lead_time_days', { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Number of days after ordering to receive delivery
                  </p>
                </div>
              ) : (
                <div className="mt-3">
                  <DeliveryScheduleBuilder supplierId={supplier?.id} />
                </div>
              )}
            </div>

            <div className="col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" {...register('address')} />
            </div>

            <div>
              <Label htmlFor="minimum_order_value">Minimum Order Value (£)</Label>
              <Input
                id="minimum_order_value"
                type="number"
                step="0.01"
                {...register('minimum_order_value', { valueAsNumber: true })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="is_active"
                type="checkbox"
                {...register('is_active')}
                className="h-4 w-4"
              />
              <Label htmlFor="is_active">Active Supplier</Label>
            </div>

            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" {...register('notes')} rows={3} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {supplier ? 'Update Supplier' : 'Create Supplier'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
