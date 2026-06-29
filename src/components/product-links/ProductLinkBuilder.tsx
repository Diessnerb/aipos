import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronRight, Trash2, ArrowLeft, Save, FolderOpen, Pencil, Check, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useProductLinks } from '@/hooks/useProductLinks';
import { useLinkTemplates } from '@/hooks/useLinkTemplates';
import { ProductLink, PricingMode } from '@/types/productLinks';
import { LinkTemplate, TemplateOption } from '@/types/linkTemplates';
import { useCurrencyFormatter } from '@/utils/currencyFormatter';
import { SaveTemplateModal } from './SaveTemplateModal';
import { LoadTemplateModal } from './LoadTemplateModal';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ProductLinkBuilderProps {
  open: boolean;
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: number | null;
  onClose: () => void;
}

export const ProductLinkBuilder: React.FC<ProductLinkBuilderProps> = ({
  open,
  menuItemId,
  menuItemName,
  menuItemPrice,
  onClose,
}) => {
  const { productLinks, createLink, createLinkSilent, updateLink, updateLinkSilent, deleteLink } = useProductLinks(menuItemId);
  const { getCurrencySymbol } = useCurrencyFormatter();
  const currencySymbol = getCurrencySymbol();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentParentPath, setCurrentParentPath] = useState<ProductLink[]>([]);
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionPrice, setNewOptionPrice] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPrice, setEditingPrice] = useState('');

  const pricingMode: PricingMode = menuItemPrice && menuItemPrice > 0 ? 'modifier' : 'base_price';

  // Get company ID from the menu item
  const { data: companyId } = useQuery({
    queryKey: ['menu-item-company', menuItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('company_id')
        .eq('id', menuItemId)
        .single();

      if (error) throw error;
      return data.company_id;
    },
  });

  const { templates, saveTemplate, deleteTemplate } = useLinkTemplates(companyId);

  // Build tree structure
  const linkTree = useMemo(() => {
    const tree: { [key: string]: ProductLink & { children: ProductLink[] } } = {};
    const rootLinks: (ProductLink & { children: ProductLink[] })[] = [];

    productLinks.forEach(link => {
      tree[link.id] = { ...link, children: [] };
    });

    productLinks.forEach(link => {
      if (link.parent_link_id && tree[link.parent_link_id]) {
        tree[link.parent_link_id].children.push(tree[link.id]);
      } else if (!link.parent_link_id && link.level === 1) {
        rootLinks.push(tree[link.id]);
      }
    });

    return rootLinks;
  }, [productLinks]);

  // Get current level options
  const currentLevelOptions = useMemo(() => {
    if (currentLevel === 1) {
      return linkTree;
    }

    const parentId = currentParentPath[currentParentPath.length - 1]?.id;
    if (!parentId) return [];

    return productLinks.filter(
      link => link.parent_link_id === parentId && link.level === currentLevel
    );
  }, [currentLevel, currentParentPath, productLinks, linkTree]);

  const handleAddOption = async () => {
    if (!newOptionName.trim()) return;

    const priceValue = parseFloat(newOptionPrice) || 0;
    
    await createLink({
      menu_item_id: menuItemId,
      parent_link_id: currentLevel === 1 ? null : currentParentPath[currentParentPath.length - 1]?.id || null,
      level: currentLevel,
      option_name: newOptionName.trim(),
      price_modifier: currentLevel === 1 && pricingMode === 'modifier' ? priceValue : currentLevel > 1 ? priceValue : null,
      base_price: currentLevel === 1 && pricingMode === 'base_price' ? priceValue : null,
      display_order: currentLevelOptions.length,
      is_active: true,
    });

    setNewOptionName('');
    setNewOptionPrice('');
  };

  const handleDeleteOption = async (optionId: string) => {
    await deleteLink(optionId);
  };

  const handleNavigateToChild = (option: ProductLink) => {
    setCurrentParentPath([...currentParentPath, option]);
    setCurrentLevel(currentLevel + 1);
  };

  const handleNavigateBack = () => {
    if (currentLevel > 1) {
      setCurrentParentPath(currentParentPath.slice(0, -1));
      setCurrentLevel(currentLevel - 1);
    }
  };

  const getPriceLabel = () => {
    if (currentLevel === 1) {
      return pricingMode === 'base_price' ? `Base Price (${currencySymbol})` : `Price Modifier (${currencySymbol})`;
    }
    return `Price Modifier (${currencySymbol})`;
  };

  const getPriceHint = () => {
    if (currentLevel === 1 && pricingMode === 'base_price') {
      return 'Set the starting price for this option';
    }
    return 'Enter +0.00 for no additional cost';
  };

  const handleSaveTemplate = async (templateName: string) => {
    if (currentLevelOptions.length === 0) {
      toast({
        title: 'Cannot save template',
        description: 'No options at current level. Add options before saving a template.',
        variant: 'destructive',
      });
      return;
    }

    // Save only options from the current level being viewed
    const templateOptions: TemplateOption[] = currentLevelOptions.map(option => ({
      option_name: option.option_name,
      price: option.base_price ?? option.price_modifier ?? 0,
    }));

    await saveTemplate({
      templateName,
      templateOptions,
    });
  };

  const handleLoadTemplate = async (template: LinkTemplate) => {
    // Load template options at the current level
    const currentParentId = currentLevel === 1 ? null : currentParentPath[currentParentPath.length - 1]?.id || null;

    for (const [index, option] of template.link_structure_json.entries()) {
      await createLinkSilent({
        menu_item_id: menuItemId,
        parent_link_id: currentParentId,
        level: currentLevel,
        option_name: option.option_name,
        // Adapt price based on current context
        price_modifier: currentLevel === 1 && pricingMode === 'modifier' ? option.price : 
                        currentLevel > 1 ? option.price : null,
        base_price: currentLevel === 1 && pricingMode === 'base_price' ? option.price : null,
        display_order: currentLevelOptions.length + index,
        is_active: true,
      });
    }

    toast({
      title: `"${template.template_name}" template loaded successfully`,
      description: `Added ${template.link_structure_json.length} option${template.link_structure_json.length !== 1 ? 's' : ''} at Level ${currentLevel}.`,
    });
  };

  const handleStartEdit = (option: ProductLink) => {
    setEditingOptionId(option.id);
    setEditingName(option.option_name);
    const priceValue = option.base_price ?? option.price_modifier ?? 0;
    setEditingPrice(priceValue.toString());
  };

  const handleSaveEdit = async () => {
    if (!editingName.trim() || !editingOptionId) return;

    const priceValue = parseFloat(editingPrice) || 0;
    const option = productLinks.find(l => l.id === editingOptionId);
    
    if (!option) return;

    const updates: Partial<ProductLink> = {
      option_name: editingName.trim(),
    };

    // Update price based on level and pricing mode
    if (option.level === 1 && pricingMode === 'base_price') {
      updates.base_price = priceValue;
      updates.price_modifier = null;
    } else {
      updates.price_modifier = priceValue;
      updates.base_price = null;
    }

    await updateLink({ id: editingOptionId, ...updates });
    
    setEditingOptionId(null);
    setEditingName('');
    setEditingPrice('');
  };

  const handleCancelEdit = () => {
    setEditingOptionId(null);
    setEditingName('');
    setEditingPrice('');
  };

  const handleMoveUp = async (option: ProductLink, currentIndex: number) => {
    if (currentIndex === 0) return; // Already at top
    
    const previousOption = currentLevelOptions[currentIndex - 1];
    
    // Batch both updates in parallel for faster execution
    await Promise.all([
      updateLinkSilent({ id: option.id, display_order: previousOption.display_order }),
      updateLinkSilent({ id: previousOption.id, display_order: option.display_order }),
    ]);
  };

  const handleMoveDown = async (option: ProductLink, currentIndex: number) => {
    if (currentIndex === currentLevelOptions.length - 1) return; // Already at bottom
    
    const nextOption = currentLevelOptions[currentIndex + 1];
    
    // Batch both updates in parallel for faster execution
    await Promise.all([
      updateLinkSilent({ id: option.id, display_order: nextOption.display_order }),
      updateLinkSilent({ id: nextOption.id, display_order: option.display_order }),
    ]);
  };

  const hasChildren = (optionId: string) => {
    return productLinks.some(link => link.parent_link_id === optionId);
  };

  const handleSaveAndClose = () => {
    toast({
      title: 'Product links saved',
      description: 'Your product link configuration has been saved successfully.',
    });
    
    // Invalidate menu items query to refresh the list
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['menu_items', companyId] });
      queryClient.invalidateQueries({ queryKey: ['menu-item-product-links', companyId] });
    }, 300);
    
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Product Links</DialogTitle>
          <DialogDescription>
            {menuItemName} - {pricingMode === 'base_price' ? 'Base Price Setter Mode' : `Add-on Modifier Mode (${currencySymbol}${menuItemPrice?.toFixed(2)})`}
          </DialogDescription>
          <div className="flex items-center gap-2 pt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowSaveModal(true)}
              disabled={currentLevelOptions.length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              Save as Template
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowLoadModal(true)}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Load Template
            </Button>
          </div>
        </DialogHeader>

        <div className="w-full space-y-6 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Level {currentLevel}</span>
            {currentParentPath.length > 0 && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span>{currentParentPath.map(p => p.option_name).join(' → ')}</span>
              </>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Add New Option - Level {currentLevel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="option-name">Option Name</Label>
                <Input
                  id="option-name"
                  placeholder={currentLevel === 1 ? "e.g., As it comes, + Tea, + Mixer" : "e.g., Cold, Iced, Extra Shot"}
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="option-price">{getPriceLabel()}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {pricingMode === 'modifier' || currentLevel > 1 ? '+' : ''}{currencySymbol}
                  </span>
                  <Input
                    id="option-price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-10"
                    value={newOptionPrice}
                    onChange={(e) => setNewOptionPrice(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{getPriceHint()}</p>
              </div>

              <Button onClick={handleAddOption} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentLevel > 1 && (
                  <button
                    onClick={handleNavigateBack}
                    className="hover:bg-accent rounded-md p-1 transition-colors"
                    aria-label="Go back to previous level"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <span>Level {currentLevel} Options</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentLevelOptions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No options defined yet. Add your first option to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {currentLevelOptions.map((option) => (
                    <div
                      key={option.id}
                      className={`flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors ${
                        currentLevel < 5 && editingOptionId !== option.id ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => editingOptionId !== option.id && currentLevel < 5 && handleNavigateToChild(option)}
                    >
                      {editingOptionId === option.id ? (
                        <>
                          <div className="flex-1 space-y-2">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Option name"
                              className="h-9"
                            />
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                {(option.level > 1 || pricingMode === 'modifier') ? '+' : ''}{currencySymbol}
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="0.00"
                                className="h-9 pl-10"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit();
                              }}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEdit();
                              }}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex-1">
                            <div className="font-medium">{option.option_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {option.base_price !== null && `${currencySymbol}${option.base_price.toFixed(2)}`}
                              {option.price_modifier !== null && `+${currencySymbol}${option.price_modifier.toFixed(2)}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Up/Down Arrow Buttons */}
                            <div className="flex flex-col gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-6 p-0"
                                disabled={currentLevelOptions.indexOf(option) === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveUp(option, currentLevelOptions.indexOf(option));
                                }}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-6 p-0"
                                disabled={currentLevelOptions.indexOf(option) === currentLevelOptions.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveDown(option, currentLevelOptions.indexOf(option));
                                }}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            <Badge variant="secondary" className="text-xs">
                              {hasChildren(option.id) ? 'More Links' : 'Last Link'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(option);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOption(option.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSaveAndClose}>
            Save & Close
          </Button>
        </DialogFooter>

        <SaveTemplateModal
          open={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveTemplate}
        />

        <LoadTemplateModal
          open={showLoadModal}
          onClose={() => setShowLoadModal(false)}
          templates={templates}
          onLoad={handleLoadTemplate}
          onDelete={deleteTemplate}
        />
      </DialogContent>
    </Dialog>
  );
};
