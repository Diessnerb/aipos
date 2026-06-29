import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSuppliers } from '@/hooks/useSuppliers';
import type { Supplier } from '@/types/delivery-db';

interface SupplierSelectorProps {
  onSelect: (supplier: Supplier) => void;
  value?: string; // supplier_id
  disabled?: boolean;
  placeholder?: string;
}

export const SupplierSelector: React.FC<SupplierSelectorProps> = ({
  onSelect,
  value,
  disabled = false,
  placeholder = 'Search suppliers...',
}) => {
  const [open, setOpen] = useState(false);
  const { suppliers, isLoading } = useSuppliers();

  const selectedSupplier = suppliers.find((s) => s.id === value);

  const getSupplierDisplayInfo = (supplier: Supplier) => {
    if (supplier.scheduling_mode === 'lead_time') {
      return `${supplier.name} - ${supplier.lead_time_days || 0} day lead time`;
    }
    return supplier.name;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
        >
          {selectedSupplier ? selectedSupplier.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'Loading suppliers...' : 'No suppliers found.'}
            </CommandEmpty>
            <CommandGroup>
              {suppliers.map((supplier) => (
                <CommandItem
                  key={supplier.id}
                  value={supplier.name}
                  onSelect={() => {
                    onSelect(supplier);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === supplier.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{supplier.name}</span>
                    {supplier.scheduling_mode === 'lead_time' && (
                      <span className="text-xs text-muted-foreground">
                        {supplier.lead_time_days || 0} day lead time
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
