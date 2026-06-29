
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';

const SidebarToggle = () => {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleSidebar}
      className="h-8 w-8 p-0 hover:bg-gray-100 transition-all duration-300 rounded-md"
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {isCollapsed ? (
        <ChevronRight className="h-4 w-4 text-gray-600 transition-transform duration-300" />
      ) : (
        <ChevronLeft className="h-4 w-4 text-gray-600 transition-transform duration-300" />
      )}
    </Button>
  );
};

export default SidebarToggle;
