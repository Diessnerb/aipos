import React, { useState } from 'react';
import { BarChart3, Package, Pencil, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatStockDisplay } from '@/lib/unitConversions';
import { LinkedItemsModal } from './LinkedItemsModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface MenuItemUsage {
  id: string;
  name: string;
}

interface UsageStockOverviewProps {
  ingredientName: string;
  onNameChange: (newName: string) => void;
  menuItemCount: number;
  menuItems: MenuItemUsage[];
  stockLevel: number;
  stockUnit: string;
  lastUpdated?: string;
}

export const UsageStockOverview: React.FC<UsageStockOverviewProps> = ({
  ingredientName,
  onNameChange,
  menuItemCount,
  menuItems,
  stockLevel,
  stockUnit,
  lastUpdated,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(ingredientName);
  
  const timeAgo = lastUpdated
    ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })
    : 'Never';

  const handleSave = () => {
    if (editedName.trim() && editedName !== ingredientName) {
      onNameChange(editedName.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedName(ingredientName);
    setIsEditing(false);
  };

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        {/* Ingredient Name Section */}
        <div className="col-span-full mb-4 pb-4 border-b border-blue-200 dark:border-blue-700">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="text-2xl font-bold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
              />
              <Button onClick={handleSave} size="sm" variant="ghost" type="button">
                <Check className="h-4 w-4" />
              </Button>
              <Button onClick={handleCancel} size="sm" variant="ghost" type="button">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">{ingredientName}</h2>
              <button
                onClick={() => {
                  setIsEditing(true);
                  setEditedName(ingredientName);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                type="button"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Menu Items Usage */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h4 className="text-base font-semibold text-foreground">Menu Items Using This</h4>
          </div>
          
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {menuItemCount} <span className="text-lg font-normal text-muted-foreground">Items</span>
          </div>
          
          {menuItemCount === 0 ? (
            <p className="text-sm text-muted-foreground">Not used in any menu items yet</p>
          ) : (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline hover:no-underline cursor-pointer transition-colors"
            >
              Linked Items →
            </button>
          )}
        </div>
        
        {/* Stock Level */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-6 w-6 text-muted-foreground" />
            <h4 className="text-base font-semibold text-foreground">Current Stock Level</h4>
          </div>
          
          <div className="text-3xl font-bold text-foreground mb-2">
            {formatStockDisplay(stockLevel, stockUnit)}
          </div>
          
          <p className="text-sm text-muted-foreground">
            Last updated {timeAgo}
          </p>
        </div>
      </div>
      
      <LinkedItemsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        menuItems={menuItems}
      />
    </div>
  );
};
