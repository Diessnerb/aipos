import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, UserPlus, Search, Menu } from 'lucide-react';

interface QuickAccessButtonsProps {
  onAddReservation: () => void;
  onWalkIn: () => void;
  onFindCustomer: () => void;
  onSearchMenu: () => void;
  disabled?: boolean;
}

export const QuickAccessButtons: React.FC<QuickAccessButtonsProps> = ({
  onAddReservation,
  onWalkIn,
  onFindCustomer,
  onSearchMenu,
  disabled = false,
}) => {
  return (
    <div className="grid grid-cols-2 gap-2 p-4 border-b bg-gradient-to-br from-background to-primary/5">
      <Button
        onClick={onAddReservation}
        disabled={disabled}
        className="h-16 flex-col gap-1 bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all duration-200 hover:scale-105"
        variant="outline"
      >
        <Plus className="h-5 w-5" />
        <span className="text-xs font-medium">Add Reservation</span>
      </Button>
      
      <Button
        onClick={onWalkIn}
        disabled={disabled}
        className="h-16 flex-col gap-1 bg-accent/10 hover:bg-accent/20 border border-accent/20 transition-all duration-200 hover:scale-105"
        variant="outline"
      >
        <UserPlus className="h-5 w-5" />
        <span className="text-xs font-medium">Walk-In</span>
      </Button>
      
      <Button
        onClick={onFindCustomer}
        disabled={disabled}
        className="h-16 flex-col gap-1 bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 transition-all duration-200 hover:scale-105"
        variant="outline"
      >
        <Search className="h-5 w-5" />
        <span className="text-xs font-medium">Find Customer</span>
      </Button>
      
      <Button
        onClick={onSearchMenu}
        disabled={disabled}
        className="h-16 flex-col gap-1 bg-muted hover:bg-muted/80 border border-border transition-all duration-200 hover:scale-105"
        variant="outline"
      >
        <Menu className="h-5 w-5" />
        <span className="text-xs font-medium">Search Menu</span>
      </Button>
    </div>
  );
};
