import * as React from 'react';
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
import { useIngredients } from '@/hooks/useIngredients';
import { Ingredient } from '@/types/ingredients';

interface IngredientSelectorProps {
  onSelect: (ingredient: Ingredient) => void;
  value?: string;
  disabled?: boolean;
  placeholder?: string;
  onQuickAdd?: () => void;
}

export function IngredientSelector({
  onSelect,
  value,
  disabled = false,
  placeholder = 'Search ingredients...',
  onQuickAdd,
}: IngredientSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const { ingredients, isLoading } = useIngredients();

  const selectedIngredient = React.useMemo(
    () => ingredients.find((ingredient) => ingredient.id === value),
    [ingredients, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className="w-full justify-between"
        >
          {selectedIngredient ? (
            <span className="flex justify-between w-full">
              <span>{selectedIngredient.name}</span>
              <span className="text-muted-foreground">
                £{selectedIngredient.sale_price.toFixed(2)}/{selectedIngredient.portion_type}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search ingredients..." />
          <CommandList>
            <CommandEmpty>
              <div className="p-4 text-center space-y-2">
                <p className="text-sm text-muted-foreground">No ingredients found.</p>
                {onQuickAdd && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      onQuickAdd();
                    }}
                  >
                    Add to library
                  </Button>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup heading="Ingredients">
              {ingredients.map((ingredient) => (
                <CommandItem
                  key={ingredient.id}
                  value={ingredient.name}
                  onSelect={() => {
                    onSelect(ingredient);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === ingredient.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex justify-between w-full">
                    <span>{ingredient.name}</span>
                    <span className="text-muted-foreground text-sm">
                      £{ingredient.sale_price.toFixed(2)}/{ingredient.portion_type}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
