import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChefHat, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getBoundCompany } from '@/utils/deviceBinding';

interface MenuSetupStepProps {
  onComplete: () => void;
  isCompleted: boolean;
}

interface MenuItem {
  name: string;
  description: string;
  price: number;
  category: string;
}

interface MenuCategory {
  name: string;
  description: string;
  items: MenuItem[];
}

export const MenuSetupStep: React.FC<MenuSetupStepProps> = ({ onComplete, isCompleted }) => {
  const [categories, setCategories] = useState<MenuCategory[]>([
    {
      name: 'Appetizers',
      description: 'Starters and small plates',
      items: [
        { name: 'Caesar Salad', description: 'Fresh romaine lettuce with parmesan and croutons', price: 12.99, category: 'Appetizers' }
      ]
    }
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const addCategory = () => {
    setCategories([...categories, {
      name: 'New Category',
      description: '',
      items: []
    }]);
  };

  const removeCategory = (categoryIndex: number) => {
    setCategories(categories.filter((_, i) => i !== categoryIndex));
  };

  const updateCategory = (index: number, field: 'name' | 'description', value: string) => {
    const updated = [...categories];
    updated[index] = { ...updated[index], [field]: value };
    setCategories(updated);
  };

  const addMenuItem = (categoryIndex: number) => {
    const updated = [...categories];
    updated[categoryIndex].items.push({
      name: 'New Item',
      description: '',
      price: 0,
      category: updated[categoryIndex].name
    });
    setCategories(updated);
  };

  const removeMenuItem = (categoryIndex: number, itemIndex: number) => {
    const updated = [...categories];
    updated[categoryIndex].items = updated[categoryIndex].items.filter((_, i) => i !== itemIndex);
    setCategories(updated);
  };

  const updateMenuItem = (categoryIndex: number, itemIndex: number, field: keyof MenuItem, value: string | number) => {
    const updated = [...categories];
    updated[categoryIndex].items[itemIndex] = {
      ...updated[categoryIndex].items[itemIndex],
      [field]: value
    };
    setCategories(updated);
  };

  const createMenu = async () => {
    const boundCompany = getBoundCompany();
    if (!boundCompany) {
      toast({
        title: 'Error',
        description: 'No company found. Please try logging in again.',
        variant: 'destructive'
      });
      return;
    }

    setIsCreating(true);
    try {
      // Create categories first
      const categoriesData = categories.map((category, index) => ({
        company_id: boundCompany.company_id,
        name: category.name,
        description: category.description,
        display_order: index,
        is_active: true
      }));

      const { data: createdCategories, error: categoryError } = await supabase
        .from('menu_categories')
        .insert(categoriesData)
        .select();

      if (categoryError) throw categoryError;

      // Create menu items
      const allItems: any[] = [];
      categories.forEach((category, categoryIndex) => {
        const categoryId = createdCategories?.[categoryIndex]?.id;
        if (categoryId) {
          category.items.forEach((item, itemIndex) => {
            allItems.push({
              company_id: boundCompany.company_id,
              category_id: categoryId,
              name: item.name,
              description: item.description,
              price: item.price,
              display_order: itemIndex
            });
          });
        }
      });

      if (allItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('menu_items')
          .insert(allItems);

        if (itemsError) throw itemsError;
      }

      toast({
        title: 'Menu created successfully',
        description: `Created ${categories.length} categories and ${allItems.length} menu items.`
      });

      onComplete();
    } catch (error: any) {
      console.error('Error creating menu:', error);
      toast({
        title: 'Error creating menu',
        description: error.message || 'Failed to create menu',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const loadTemplate = (template: 'cafe' | 'restaurant' | 'pub') => {
    const templates = {
      cafe: [
        {
          name: 'Coffee & Tea',
          description: 'Hot and cold beverages',
          items: [
            { name: 'Espresso', description: 'Rich Italian coffee', price: 3.50, category: 'Coffee & Tea' },
            { name: 'Cappuccino', description: 'Espresso with steamed milk foam', price: 4.25, category: 'Coffee & Tea' },
            { name: 'Green Tea', description: 'Organic loose leaf tea', price: 3.00, category: 'Coffee & Tea' }
          ]
        },
        {
          name: 'Pastries',
          description: 'Fresh baked goods',
          items: [
            { name: 'Croissant', description: 'Buttery French pastry', price: 3.75, category: 'Pastries' },
            { name: 'Muffin', description: 'Blueberry or chocolate chip', price: 4.50, category: 'Pastries' }
          ]
        }
      ],
      restaurant: [
        {
          name: 'Appetizers',
          description: 'Starters and small plates',
          items: [
            { name: 'Caesar Salad', description: 'Romaine lettuce, parmesan, croutons', price: 12.99, category: 'Appetizers' },
            { name: 'Calamari', description: 'Crispy squid rings with marinara', price: 14.99, category: 'Appetizers' }
          ]
        },
        {
          name: 'Main Courses',
          description: 'Hearty entrees',
          items: [
            { name: 'Grilled Salmon', description: 'Atlantic salmon with vegetables', price: 26.99, category: 'Main Courses' },
            { name: 'Ribeye Steak', description: '12oz prime cut with potatoes', price: 34.99, category: 'Main Courses' }
          ]
        },
        {
          name: 'Desserts',
          description: 'Sweet endings',
          items: [
            { name: 'Chocolate Cake', description: 'Rich chocolate layer cake', price: 8.99, category: 'Desserts' }
          ]
        }
      ],
      pub: [
        {
          name: 'Pub Food',
          description: 'Classic comfort food',
          items: [
            { name: 'Fish & Chips', description: 'Beer battered cod with fries', price: 16.99, category: 'Pub Food' },
            { name: 'Burger & Fries', description: 'Beef patty with all the fixings', price: 14.99, category: 'Pub Food' },
            { name: 'Wings', description: 'Buffalo or BBQ style', price: 12.99, category: 'Pub Food' }
          ]
        }
      ]
    };
    setCategories(templates[template]);
  };

  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold flex items-center justify-center gap-2">
          {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
          Menu Setup
        </h3>
        <p className="text-muted-foreground">
          Create your menu categories and add items
        </p>
      </div>

      {/* Quick Templates */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Quick Start Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => loadTemplate('cafe')}>
              <ChefHat className="h-4 w-4 mr-1" />
              Café Menu
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadTemplate('restaurant')}>
              <ChefHat className="h-4 w-4 mr-1" />
              Restaurant Menu
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadTemplate('pub')}>
              <ChefHat className="h-4 w-4 mr-1" />
              Pub Menu
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <div className="space-y-4">
        {categories.map((category, categoryIndex) => (
          <Card key={categoryIndex}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Category name"
                    value={category.name}
                    onChange={(e) => updateCategory(categoryIndex, 'name', e.target.value)}
                    className="font-medium"
                  />
                  <Input
                    placeholder="Category description (optional)"
                    value={category.description}
                    onChange={(e) => updateCategory(categoryIndex, 'description', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge variant="secondary">
                    {category.items.length} items
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeCategory(categoryIndex)}
                    disabled={categories.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Menu Items */}
              {category.items.map((item, itemIndex) => (
                <div key={itemIndex} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border rounded-lg">
                  <div>
                    <Label className="text-xs">Item Name</Label>
                    <Input
                      placeholder="Item name"
                      value={item.name}
                      onChange={(e) => updateMenuItem(categoryIndex, itemIndex, 'name', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Description</Label>
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateMenuItem(categoryIndex, itemIndex, 'description', e.target.value)}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Price ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={item.price || ''}
                        onChange={(e) => updateMenuItem(categoryIndex, itemIndex, 'price', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeMenuItem(categoryIndex, itemIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {/* Add Item Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addMenuItem(categoryIndex)}
                className="w-full border-2 border-dashed"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Menu Item
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Category Button */}
      <div className="flex justify-center">
        <Button 
          variant="outline" 
          onClick={addCategory}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Summary */}
      <div className="text-center text-sm text-muted-foreground">
        <p>{categories.length} categories • {totalItems} menu items</p>
      </div>

      {/* Action Button */}
      <div className="flex justify-center pt-4">
        <Button 
          onClick={createMenu}
          disabled={isCreating || categories.length === 0}
          size="lg"
        >
          {isCreating ? 'Creating Menu...' : 'Create Menu'}
        </Button>
      </div>
    </div>
  );
};