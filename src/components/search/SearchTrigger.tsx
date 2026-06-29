
import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSidebar } from '@/components/ui/sidebar';

interface SearchTriggerProps {
  onClick: () => void;
}

export const SearchTrigger: React.FC<SearchTriggerProps> = ({ onClick }) => {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          onClick={onClick}
          className={`w-full flex items-center text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 group ${
            isCollapsed ? 'justify-center px-3 py-3' : 'justify-start px-3 py-3 space-x-3'
          }`}
        >
          <Search 
            className="h-6 w-6 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" 
            strokeWidth={1.5} 
          />
          {!isCollapsed && <span className="font-medium">Search</span>}
        </Button>
      </TooltipTrigger>
      {isCollapsed && (
        <TooltipContent side="right" align="center">
          Search anything... (⌘K)
        </TooltipContent>
      )}
    </Tooltip>
  );
};
