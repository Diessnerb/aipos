import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Minus, Plus, X, ArrowLeft, Pencil, Printer, FolderOpen, Percent } from 'lucide-react';
import { OpenTabsModal } from './OpenTabsModal';
import { useLoadOrder } from '@/hooks/useLoadOrder';
import { useOrderBasket } from '@/contexts/OrderBasketContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { SplitBillModal } from './SplitBillModal';
import { OrderAssignment } from './OrderAssignment';
import { useSaveOrder } from '@/hooks/useSaveOrder';
import { MenuItemDetailModal } from '@/components/menu/MenuItemDetailModal';
import { useMenuItemProductLinks } from '@/hooks/useMenuItemProductLinks';
import { useProductLinks } from '@/hooks/useProductLinks';
import { BasketItem } from '@/contexts/OrderBasketContext';
import { SelectedOptions } from '@/utils/productLinkCalculator';
import { IngredientModification } from '@/types/ingredients';
import { CourseBadge, CourseType } from './CourseBadge';
import { SwipeableCartItem } from './SwipeableCartItem';
import { useOrderEditValidation, CourseEditPermissions } from '@/hooks/useOrderEditValidation';

const ActionButtons = () => {
  const { 
    basketItems, 
    total, 
    setPaymentMode, 
    isPaymentMode, 
    setCurrentSplitIndex, 
    setSplitBills,
    orderAssignment,
    clearBasket,
    loadedOrderId,
    scheduledFor
  } = useOrderBasket();
  const { isAdmin, isManager, user } = useAuth();
  const { toast } = useToast();
  const { saveOrder } = useSaveOrder();
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [isSavingTab, setIsSavingTab] = useState(false);

  const handleTabClick = async () => {
    if (basketItems.length === 0) {
      toast({
        title: "Empty Basket",
        description: "Please add items to the basket before creating a tab.",
        variant: "destructive",
      });
      return;
    }

    if (!orderAssignment) {
      toast({
        title: "Assignment Required",
        description: "Please assign a table or customer name before creating a tab.",
        variant: "destructive",
      });
      return;
    }

    console.info('[POS] Add to Tab start', { 
      items: basketItems.length, 
      total, 
      assignment: orderAssignment, 
      userId: user?.id,
      scheduledFor
    });

    setIsSavingTab(true);
    try {
      const { orderNumber, orderId } = await saveOrder({
        basketItems,
        total,
        orderAssignment,
        status: 'unpaid',
        userId: user?.id,
        orderId: loadedOrderId,
        scheduledFor,
      });

      console.info('[POS] Tab operation success', { 
        mode: loadedOrderId ? 'UPDATE' : 'CREATE',
        orderNumber 
      });

      toast({
        title: loadedOrderId ? "Tab Updated" : "Tab Created",
        description: `Order #${orderNumber} has been ${loadedOrderId ? 'updated and' : ''} sent to kitchen.`,
      });

      clearBasket();
    } catch (error) {
      console.error('[POS] Add to Tab failed', { error });
      toast({
        title: "Error",
        description: "Failed to create tab. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingTab(false);
    }
  };

  const handlePayClick = () => {
    if (basketItems.length === 0) {
      toast({
        title: "Empty Basket",
        description: "Please add items to the basket before processing payment.",
        variant: "destructive",
      });
      return;
    }
    setPaymentMode(true);
  };

  const handlePriceOverride = () => {
    if (!isAdmin && !isManager) {
      toast({
        title: "Insufficient Permissions",
        description: "Price override is only available to Admin and Manager roles.",
        variant: "destructive",
      });
      return;
    }
    // TODO: Implement price override functionality
    toast({
      title: "Price Override",
      description: "Price override functionality coming soon.",
    });
  };

  const handleSplit = () => {
    if (basketItems.length === 0) {
      toast({
        title: "Empty Basket",
        description: "Please add items to the basket before splitting the bill.",
        variant: "destructive",
      });
      return;
    }
    setShowSplitModal(true);
  };

  const handleCancelPayment = () => {
    setPaymentMode(false);
    setSplitBills([]);
    setCurrentSplitIndex(0);
  };

  if (isPaymentMode) {
    return (
      <Button
        onClick={handleCancelPayment}
        variant="outline"
        size="lg"
        className="w-full min-h-[80px]"
      >
        <ArrowLeft className="mr-2 h-5 w-5" />
        Back to Order
      </Button>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleTabClick}
          variant="outline"
          size="lg"
          disabled={isSavingTab}
          className="h-14 text-sm font-semibold"
        >
          {isSavingTab ? 'Saving...' : (loadedOrderId ? 'Update Tab' : 'Add to Tab')}
        </Button>
        <Button
          onClick={handlePayClick}
          variant="default"
          size="lg"
          className="h-14 text-sm font-semibold"
        >
          Pay
        </Button>
        <Button
          onClick={handlePriceOverride}
          variant="outline"
          size="lg"
          className="h-14 text-sm font-semibold"
        >
          Price Override
        </Button>
        <Button
          onClick={handleSplit}
          variant="outline"
          size="lg"
          className="h-14 text-sm font-semibold"
        >
          Split
        </Button>
      </div>
      <SplitBillModal open={showSplitModal} onOpenChange={setShowSplitModal} />
    </>
  );
};

export const OrderBasket = () => {
  const { 
    basketItems, 
    updateQuantity, 
    updateCourseType, 
    splitItemToDifferentCourse, 
    removeFromBasket, 
    addToBasket,
    updateBasketItem,
    applyDiscount,
    applyPriceOverride,
    subtotal, 
    discount, 
    amountPaid,
    total, 
    isPaymentMode, 
    orderAssignment,
    selectedItemsForPayment,
    toggleItemSelection,
    loadedOrderId,
    appliedDeals,
  } = useOrderBasket();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: productLinksMap = {} } = useMenuItemProductLinks(user?.user_metadata?.company_id || null);
  
  const [editingItem, setEditingItem] = useState<BasketItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showOpenTabsModal, setShowOpenTabsModal] = useState(false);
  const [editPermissions, setEditPermissions] = useState<CourseEditPermissions | null>(null);
  const { loadOrder } = useLoadOrder();
  const { getEditPermissions } = useOrderEditValidation();
  
  // Fetch product links for the item being edited
  const { productLinks: editProductLinks } = useProductLinks(editingItem?.menuItem.id || '');

  // Load edit permissions when order is loaded
  React.useEffect(() => {
    if (loadedOrderId) {
      getEditPermissions(loadedOrderId).then(setEditPermissions);
    } else {
      setEditPermissions(null);
    }
  }, [loadedOrderId, getEditPermissions]);

  const formatCurrency = (value: number) => `£${value.toFixed(2)}`;
  
  // Helper to get selection info for an item
  const getItemSelectionInfo = (itemId: string) => {
    return selectedItemsForPayment.find(s => s.basketItemId === itemId);
  };

  // Group items by course
  const itemsByCourse = {
    drinks: basketItems.filter(item => item.courseType === 'drinks'),
    starter: basketItems.filter(item => item.courseType === 'starter'),
    main: basketItems.filter(item => item.courseType === 'main'),
    dessert: basketItems.filter(item => item.courseType === 'dessert'),
  };

  // Calculate total quantity for each course
  const getTotalQuantityForCourse = (courseItems: BasketItem[]) => {
    return courseItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const courseQuantities = {
    drinks: getTotalQuantityForCourse(itemsByCourse.drinks),
    starter: getTotalQuantityForCourse(itemsByCourse.starter),
    main: getTotalQuantityForCourse(itemsByCourse.main),
    dessert: getTotalQuantityForCourse(itemsByCourse.dessert),
  };

  const handleCourseChange = (itemId: string, currentCourse: CourseType) => {
    const courseOrder: CourseType[] = ['drinks', 'starter', 'main', 'dessert'];
    const currentIndex = courseOrder.indexOf(currentCourse);
    const nextCourse = courseOrder[(currentIndex + 1) % courseOrder.length];
    splitItemToDifferentCourse(itemId, nextCourse);
  };

  const handleItemClick = (item: BasketItem) => {
    if (isPaymentMode) {
      // In payment mode - toggle selection for partial payment
      toggleItemSelection(item.id);
    } else {
      // In order mode - open edit modal
      setEditingItem(item);
      setIsEditModalOpen(true);
    }
  };

  const handleUpdateBasketItem = (
    selectedOptions: SelectedOptions,
    price: number,
    breakdown: any[],
    ingredientMods?: IngredientModification[],
    notes?: string
  ) => {
    if (!editingItem) return;
    
    // Create new configuration
    const newConfiguration: BasketItem['configuration'] = {
      selectedOptions,
      breakdown,
      ingredientModifications: ingredientMods
    };
    
    // Use the new updateBasketItem function which handles quantity splitting
    updateBasketItem(editingItem.id, newConfiguration, price, notes);
    
    // Close modal
    setIsEditModalOpen(false);
    setEditingItem(null);
    
    // Show feedback
    toast({
      title: "Item Updated",
      description: `${editingItem.menuItem.name} has been updated`,
    });
  };

  return (
      <Card className="h-full flex flex-col bg-muted/30 rounded-none border-0 shadow-none">
        <CardHeader className="pb-3 px-4 border-b">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">Current Order</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              if (basketItems.length === 0) {
                setShowOpenTabsModal(true);
              } else {
                // Print receipt functionality - placeholder
                console.log('Print receipt clicked');
              }
            }}
          >
            {basketItems.length === 0 ? (
              <>
                <FolderOpen className="h-4 w-4" />
                Open Tabs
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                Print Receipt
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <OpenTabsModal 
        open={showOpenTabsModal} 
        onOpenChange={setShowOpenTabsModal}
        onSelectTab={(orderId) => {
          loadOrder(orderId);
          setShowOpenTabsModal(false);
        }}
      />

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Order Assignment */}
        <div className="px-4 py-2 border-b">
          <OrderAssignment />
        </div>

        {/* Course Edit Warning Banner */}
        {loadedOrderId && editPermissions && (!editPermissions.canEditStarters || !editPermissions.canEditMains || !editPermissions.canEditDesserts) && (
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Editing Order:</strong>
              {!editPermissions.canEditStarters && ' Starters locked (already served).'}
              {!editPermissions.canEditMains && ' Mains locked (already served).'}
              {!editPermissions.canEditDesserts && ' Desserts locked (already served).'}
              {editPermissions.nextAvailableCourse && ` New items will go to ${editPermissions.nextAvailableCourse}s.`}
            </p>
          </div>
        )}

        {/* Line Items - 67% */}
        <ScrollArea className="flex-1 border-b">
          <div className="px-3 py-3 space-y-4">
            {orderAssignment?.type === 'customer_name' ? (
              /* TAKEAWAY: Single flat list without course groupings */
              <div className="space-y-2">
                {basketItems.map((item) => {
                  const selectionInfo = getItemSelectionInfo(item.id);
                  return (
                    <SwipeableCartItem
                      key={item.id}
                      item={item}
                      isPaymentMode={isPaymentMode}
                      isSelected={!!selectionInfo}
                      quantitySelected={selectionInfo?.quantitySelected || 0}
                      onItemClick={handleItemClick}
                      onRemove={removeFromBasket}
                      onUpdateQuantity={updateQuantity}
                      onCourseChange={handleCourseChange}
                      formatCurrency={formatCurrency}
                      onDiscount={applyDiscount}
                      onPriceOverride={applyPriceOverride}
                    />
                  );
                })}
              </div>
            ) : (
              /* DINE-IN: Grouped by course */
              <>
                {/* Drinks Section */}
                {itemsByCourse.drinks.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-0.5 flex-1 bg-blue-200 dark:bg-blue-900/30" />
                      <span className="text-xs font-bold text-blue-800 dark:text-blue-200 uppercase tracking-wide">
                        🔵 Drinks ({courseQuantities.drinks})
                      </span>
                      <div className="h-0.5 flex-1 bg-blue-200 dark:bg-blue-900/30" />
                    </div>
                    {itemsByCourse.drinks.map((item) => {
                      const selectionInfo = getItemSelectionInfo(item.id);
                      return (
                        <SwipeableCartItem
                          key={item.id}
                          item={item}
                          isPaymentMode={isPaymentMode}
                          isSelected={!!selectionInfo}
                          quantitySelected={selectionInfo?.quantitySelected || 0}
                          onItemClick={handleItemClick}
                          onRemove={removeFromBasket}
                          onUpdateQuantity={updateQuantity}
                          onCourseChange={handleCourseChange}
                          formatCurrency={formatCurrency}
                          onDiscount={applyDiscount}
                          onPriceOverride={applyPriceOverride}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Starters Section */}
                {itemsByCourse.starter.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-0.5 flex-1 bg-green-200 dark:bg-green-900/30" />
                      <span className="text-xs font-bold text-green-800 dark:text-green-200 uppercase tracking-wide">
                        🟢 Starters ({courseQuantities.starter})
                      </span>
                      <div className="h-0.5 flex-1 bg-green-200 dark:bg-green-900/30" />
                    </div>
                {itemsByCourse.starter.map((item) => {
                  const selectionInfo = getItemSelectionInfo(item.id);
                  return (
                    <SwipeableCartItem
                      key={item.id}
                      item={item}
                      isPaymentMode={isPaymentMode}
                      isSelected={!!selectionInfo}
                      quantitySelected={selectionInfo?.quantitySelected || 0}
                      onItemClick={handleItemClick}
                      onRemove={removeFromBasket}
                      onUpdateQuantity={updateQuantity}
                      onCourseChange={handleCourseChange}
                      formatCurrency={formatCurrency}
                      onDiscount={applyDiscount}
                      onPriceOverride={applyPriceOverride}
                    />
                  );
                })}
              </div>
            )}

            {/* Mains Section */}
            {itemsByCourse.main.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-0.5 flex-1 bg-orange-200 dark:bg-orange-900/30" />
                  <span className="text-xs font-bold text-orange-800 dark:text-orange-200 uppercase tracking-wide">
                    🟠 Mains ({courseQuantities.main})
                  </span>
                  <div className="h-0.5 flex-1 bg-orange-200 dark:bg-orange-900/30" />
                </div>
                {itemsByCourse.main.map((item) => {
                  const selectionInfo = getItemSelectionInfo(item.id);
                  return (
                    <SwipeableCartItem
                      key={item.id}
                      item={item}
                      isPaymentMode={isPaymentMode}
                      isSelected={!!selectionInfo}
                      quantitySelected={selectionInfo?.quantitySelected || 0}
                      onItemClick={handleItemClick}
                      onRemove={removeFromBasket}
                      onUpdateQuantity={updateQuantity}
                      onCourseChange={handleCourseChange}
                      formatCurrency={formatCurrency}
                      onDiscount={applyDiscount}
                      onPriceOverride={applyPriceOverride}
                    />
                  );
                })}
              </div>
            )}

            {/* Desserts Section */}
            {itemsByCourse.dessert.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-0.5 flex-1 bg-purple-200 dark:bg-purple-900/30" />
                  <span className="text-xs font-bold text-purple-800 dark:text-purple-200 uppercase tracking-wide">
                    🟣 Desserts ({courseQuantities.dessert})
                  </span>
                  <div className="h-0.5 flex-1 bg-purple-200 dark:bg-purple-900/30" />
                </div>
                {itemsByCourse.dessert.map((item) => {
                  const selectionInfo = getItemSelectionInfo(item.id);
                  return (
                    <SwipeableCartItem
                      key={item.id}
                      item={item}
                      isPaymentMode={isPaymentMode}
                      isSelected={!!selectionInfo}
                      quantitySelected={selectionInfo?.quantitySelected || 0}
                      onItemClick={handleItemClick}
                      onRemove={removeFromBasket}
                      onUpdateQuantity={updateQuantity}
                      onCourseChange={handleCourseChange}
                      formatCurrency={formatCurrency}
                      onDiscount={applyDiscount}
                      onPriceOverride={applyPriceOverride}
                    />
                  );
                })}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Bottom Section - 33% */}
        <div className="flex-shrink-0 flex flex-col">
          {/* Total Summary */}
          <div className="p-4 space-y-2 border-b">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            
            {/* Applied Deals Section */}
            {appliedDeals.length > 0 && (
              <div className="border-t pt-3 mt-2">
                <div className="text-sm font-medium mb-2 text-muted-foreground">Applied Deals</div>
                {appliedDeals.map(deal => (
                  <div key={deal.dealId} className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        <Percent className="h-3 w-3 mr-1" />
                        {deal.dealName}
                      </Badge>
                    </span>
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      -{formatCurrency(deal.discountAmount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Discounts</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  -{formatCurrency(discount)}
                </span>
              </div>
            )}
            
            {amountPaid > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatCurrency(amountPaid)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={isPaymentMode ? "" : "p-4 bg-muted/50 flex flex-col gap-3"}>
            <ActionButtons />
          </div>
        </div>
      </CardContent>

      {/* Edit Item Modal */}
        <MenuItemDetailModal
          item={editingItem?.menuItem || null}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingItem(null);
          }}
          productLinks={editProductLinks}
          onAddToBasket={handleUpdateBasketItem}
          showAddToBasket={true}
          initialIngredientModifications={editingItem?.configuration?.ingredientModifications}
          initialSelectedOptions={editingItem?.configuration?.selectedOptions}
          initialNotes={editingItem?.notes}
          isEditMode={true}
        />
    </Card>
  );
};
