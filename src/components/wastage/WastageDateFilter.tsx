import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface WastageDateFilterProps {
  filter: 'last_day' | 'last_7_days' | 'custom' | 'all';
  onFilterChange: (filter: 'last_day' | 'last_7_days' | 'custom' | 'all') => void;
  customStartDate?: Date | null;
  customEndDate?: Date | null;
  onCustomRangeClick: () => void;
}

export const WastageDateFilter: React.FC<WastageDateFilterProps> = ({
  filter,
  onFilterChange,
  customStartDate,
  customEndDate,
  onCustomRangeClick,
}) => {
  const getDateRangeDisplay = () => {
    if (filter === 'all') {
      return 'All Time';
    }
    if (filter === 'last_day') {
      return 'Last 24 Hours';
    }
    if (filter === 'last_7_days') {
      return 'Last 7 Days';
    }
    if (filter === 'custom' && customStartDate && customEndDate) {
      return `${format(customStartDate, 'MMM dd, yyyy')} - ${format(customEndDate, 'MMM dd, yyyy')}`;
    }
    return 'Select Date Range';
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Date Range:</span>
        <Button
          variant={filter === 'last_day' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange('last_day')}
        >
          Last Day
        </Button>
        <Button
          variant={filter === 'last_7_days' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange('last_7_days')}
        >
          Last 7 Days
        </Button>
        <Button
          variant={filter === 'custom' ? 'default' : 'outline'}
          size="sm"
          onClick={onCustomRangeClick}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Custom Range
        </Button>
        {filter !== 'all' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFilterChange('all')}
          >
            Clear Filter
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="w-4 h-4" />
        <span>Showing: {getDateRangeDisplay()}</span>
      </div>
    </div>
  );
};
