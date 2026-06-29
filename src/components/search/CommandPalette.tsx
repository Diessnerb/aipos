
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { Loader2 } from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, setOpen }) => {
  const navigate = useNavigate();
  const { query, setQuery, groupedResults, isLoading } = useGlobalSearch();

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open, setQuery]);

  const handleSelect = (route: string) => {
    navigate(route);
    setOpen(false);
    setQuery('');
  };

  const getResultIcon = (type: string) => {
    const icons = {
      menu: '🍽️',
      customer: '👤',
      reservation: '📅',
      invoice: '📄',
      inventory: '📦',
      note: '📝',
      order: '🛒',
      location: '📍',
      supplier_order: '📋'
    };
    return icons[type as keyof typeof icons] || '📄';
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search anything... (Cmd+K)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[400px]">
        {isLoading && query.length > 0 && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Searching...</span>
          </div>
        )}
        
        <CommandEmpty>
          {query ? `No results found for "${query}"` : 'Start typing to search...'}
        </CommandEmpty>

        {Object.entries(groupedResults).map(([groupName, results]) => (
          <CommandGroup key={groupName} heading={`${groupName} (${results.length})`}>
            {results.map((result) => (
              <CommandItem
                key={result.id}
                value={`${result.title} ${result.subtitle} ${result.metadata || ''}`}
                onSelect={() => handleSelect(result.route)}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="text-lg">{getResultIcon(result.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {result.title}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {result.subtitle}
                  </div>
                  {result.metadata && (
                    <div className="text-xs text-gray-500 truncate">
                      {result.metadata}
                    </div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
};
