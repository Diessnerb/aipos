import React, { useState } from 'react';
import PermissionGuard from '@/components/PermissionGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CategoryManagement from '@/components/menu-settings/CategoryManagement';
import MenuItemsManagement from '@/components/menu-settings/MenuItemsManagement';
import MenuBuilderView from '@/components/menu-settings/MenuBuilderView';
import IngredientsManagement from '@/components/menu-settings/IngredientsManagement';
import CreateCategoryModal from '@/components/menu-settings/CreateCategoryModal';
import { AddMenuItemModal } from '@/components/modals/AddMenuItemModal';
import { AddIngredientModal } from '@/components/modals/AddIngredientModal';

const MenuSettings = () => {
  const navigate = useNavigate();
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [isAddMenuItemModalOpen, setIsAddMenuItemModalOpen] = useState(false);
  const [isAddIngredientModalOpen, setIsAddIngredientModalOpen] = useState(false);

  return (
    <PermissionGuard route="/settings/menu" requiredPermission="edit">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Button>
        </div>

        <PageHeader 
          title="Menu Settings" 
          subtitle="Manage your menu categories, subcategories, and organise menu items" 
        />

        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="items">Menu Items</TabsTrigger>
            <TabsTrigger value="ingredients">Ingredients & Stock</TabsTrigger>
            <TabsTrigger value="builder">Menu Builder</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Menu Categories & Subcategories</CardTitle>
                    <CardDescription>
                      Create and organise your menu structure with categories and subcategories
                    </CardDescription>
                  </div>
                  <Button onClick={() => setIsCreateCategoryModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Category
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <CategoryManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="items" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Menu Items Management</CardTitle>
                    <CardDescription>
                      View, edit, and organise your menu items by category
                    </CardDescription>
                  </div>
                  <Button onClick={() => setIsAddMenuItemModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <MenuItemsManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ingredients" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Ingredients & Stock Library</CardTitle>
                    <CardDescription>
                      Master list of all ingredients and stock levels - select from here when building menu items
                    </CardDescription>
                  </div>
                  <Button onClick={() => setIsAddIngredientModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Ingredient
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <IngredientsManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="builder" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Menu Builder View</CardTitle>
                <CardDescription>
                  Preview and build your complete menu structure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MenuBuilderView />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <CreateCategoryModal 
          isOpen={isCreateCategoryModalOpen}
          onClose={() => setIsCreateCategoryModalOpen(false)}
        />
        
        <AddMenuItemModal
          isOpen={isAddMenuItemModalOpen}
          onClose={() => setIsAddMenuItemModalOpen(false)}
        />

        <AddIngredientModal
          isOpen={isAddIngredientModalOpen}
          onClose={() => setIsAddIngredientModalOpen(false)}
        />
      </div>
    </PermissionGuard>
  );
};

export default MenuSettings;