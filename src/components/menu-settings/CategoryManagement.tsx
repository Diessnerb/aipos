import React, { useState } from 'react';
import { useMenuCategories, MenuCategory } from '@/hooks/useMenuCategories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Edit, Trash2, Plus, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import EditCategoryModal from './EditCategoryModal';
import CreateCategoryModal from './CreateCategoryModal';
import EnhancedDeleteCategoryModal from './EnhancedDeleteCategoryModal';

const CategoryManagement = () => {
  const { categories, isLoading, reorderCategories } = useMenuCategories();
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<MenuCategory | null>(null);
  const [createSubcategoryFor, setCreateSubcategoryFor] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()  // Start with all categories collapsed for easier navigation
  );

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    // Only allow reordering within the same parent category (subcategories)
    if (source.droppableId !== destination.droppableId) return;
    if (source.index === destination.index) return;

    // Find the parent category
    const parentCategory = categories.find(cat => 
      cat.subcategories?.some(sub => sub.id === draggableId)
    );
    
    if (!parentCategory || !parentCategory.subcategories) return;

    // Create new order for subcategories
    const newSubcategories = Array.from(parentCategory.subcategories);
    const [reorderedItem] = newSubcategories.splice(source.index, 1);
    newSubcategories.splice(destination.index, 0, reorderedItem);

    // Create updates array with new display orders
    const updates = newSubcategories.map((subcategory, index) => ({
      id: subcategory.id,
      display_order: index + 1
    }));

    reorderCategories(updates);
  };

  if (isLoading) {
    return <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
      ))}
    </div>;
  }

  const dndKey = categories.map(c => `${c.id}:${c.subcategories?.length ?? 0}`).join('|');

  return (
    <DragDropContext key={dndKey} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {categories.map((category) => (
          <Card key={category.id} className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                >
                  {expandedCategories.has(category.id) ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                  <Badge variant="secondary">
                    {category.subcategories?.length || 0} subcategories
                  </Badge>
                </button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateSubcategoryFor(category.id)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Subcategory
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingCategory(category)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Category
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setDeletingCategory(category)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Category
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {category.description && (
                <p className="text-sm text-muted-foreground">{category.description}</p>
              )}
            </CardHeader>
            
            {expandedCategories.has(category.id) && category.subcategories && category.subcategories.length > 0 && (
              <CardContent>
                <Droppable droppableId={category.id}>
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {category.subcategories.map((subcategory, index) => (
                        <Draggable
                          key={subcategory.id}
                          draggableId={subcategory.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center justify-between p-3 bg-muted/50 rounded-lg border ${
                                snapshot.isDragging ? 'shadow-lg' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  {...provided.dragHandleProps}
                                  className="text-muted-foreground hover:text-foreground cursor-move"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <div>
                                  <h4 className="font-medium">{subcategory.name}</h4>
                                  {subcategory.description && (
                                    <p className="text-sm text-muted-foreground">
                                      {subcategory.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEditingCategory(subcategory)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Subcategory
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => setDeletingCategory(subcategory)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Subcategory
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </CardContent>
            )}
          </Card>
        ))}

        {editingCategory && (
          <EditCategoryModal
            category={editingCategory}
            isOpen={!!editingCategory}
            onClose={() => setEditingCategory(null)}
          />
        )}

        {deletingCategory && (
          <EnhancedDeleteCategoryModal
            category={deletingCategory}
            isOpen={!!deletingCategory}
            onClose={() => setDeletingCategory(null)}
          />
        )}

        {createSubcategoryFor && (
          <CreateCategoryModal
            isOpen={!!createSubcategoryFor}
            onClose={() => setCreateSubcategoryFor(null)}
            parentId={createSubcategoryFor}
          />
        )}
      </div>
    </DragDropContext>
  );
};

export default CategoryManagement;