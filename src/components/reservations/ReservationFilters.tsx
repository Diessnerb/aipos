
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ReservationFiltersProps {
  filterStatus: string;
  onFilterStatusChange: (status: string) => void;
  unassignedCount?: number;
}

export const ReservationFilters: React.FC<ReservationFiltersProps> = ({
  filterStatus,
  onFilterStatusChange,
  unassignedCount = 0,
}) => {
  const filterOptions = [
    { key: 'all', label: 'All' },
    { key: 'seated', label: 'Seated' },
    { key: 'upcoming', label: 'Upcoming Reservations' },
    { key: 'unassigned', label: 'Unassigned Tables' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'no-show', label: 'No Show' },
  ];

  const handleFilterClick = (filterKey: string) => {
    console.log('=== DEBUG: Filter clicked ===');
    console.log('Filter key:', filterKey);
    console.log('Current filter status:', filterStatus);
    onFilterStatusChange(filterKey);
  };

  return (
    <div className="flex space-x-4 overflow-x-auto py-3 px-1">
      {filterOptions.map((option) => (
        <Button
          key={option.key}
          variant={filterStatus === option.key ? "default" : "outline"}
          onClick={() => handleFilterClick(option.key)}
          className="whitespace-nowrap transition-all duration-200 hover:scale-105 relative"
        >
          {option.label}
          {option.key === 'unassigned' && unassignedCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unassignedCount}
            </Badge>
          )}
        </Button>
      ))}
    </div>
  );
};
