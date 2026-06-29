import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { MenuItem } from '@/types/menu';
import { PriceBreakdownItem, SelectedOptions } from '@/utils/productLinkCalculator';
import { IngredientModification } from '@/types/ingredients';
import { useDeals } from '@/hooks/useDeals';
import { calculateAllDeals, AppliedDeal } from '@/utils/dealCalculator';

export type CourseType = 'drinks' | 'starter' | 'main' | 'dessert';

export interface BasketItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  quantityPaid?: number; // Track how many units have been paid for
  unitPrice: number;
  totalPrice: number;
  courseType: CourseType;
  notes?: string;
  configuration?: {
    selectedOptions?: SelectedOptions;
    breakdown?: PriceBreakdownItem[];
    ingredientModifications?: IngredientModification[];
  };
  discount?: {
    type: 'percentage';
    value: number; // Percentage (0-100)
  };
  priceOverride?: number; // Overrides unitPrice if set
}

export interface SelectedItemForPayment {
  basketItemId: string;
  quantitySelected: number; // How many units selected (1 to item.quantity)
}

export interface OrderAssignment {
  type: 'table' | 'customer_name';
  tableNumber?: number;
  customerName?: string;
}

interface OrderBasketContextType {
  basketItems: BasketItem[];
  setBasketItems: React.Dispatch<React.SetStateAction<BasketItem[]>>;
  addToBasket: (item: MenuItem, unitPrice: number, configuration?: BasketItem['configuration'], courseType?: CourseType, notes?: string) => void;
  updateQuantity: (basketItemId: string, newQuantity: number) => void;
  updateCourseType: (basketItemId: string, courseType: CourseType) => void;
  splitItemToDifferentCourse: (basketItemId: string, newCourseType: CourseType) => void;
  updateBasketItem: (basketItemId: string, newConfiguration: BasketItem['configuration'], newUnitPrice: number, newNotes?: string) => void;
  applyDiscount: (basketItemId: string, discountPercentage: number) => void;
  applyPriceOverride: (basketItemId: string, newPrice: number) => void;
  removeFromBasket: (basketItemId: string) => void;
  clearBasket: () => void;
  subtotal: number;
  discount: number;
  amountPaid: number;
  total: number;
  originalTotal: number;
  isPaymentMode: boolean;
  setPaymentMode: (mode: boolean) => void;
  splitBills: number[];
  setSplitBills: (bills: number[]) => void;
  currentSplitIndex: number;
  setCurrentSplitIndex: (index: number) => void;
  orderAssignment: OrderAssignment | null;
  setOrderAssignment: (assignment: OrderAssignment | null) => void;
  loadedOrderId: string | null;
  setLoadedOrderId: (orderId: string | null) => void;
  scheduledFor: Date | null;
  setScheduledFor: (date: Date | null) => void;
  selectedItemsForPayment: SelectedItemForPayment[];
  toggleItemSelection: (basketItemId: string) => void;
  clearSelectedItems: () => void;
  getSelectedItemsTotal: () => number;
  loadedAmountPaid: number;
  setLoadedAmountPaid: (amount: number) => void;
  appliedDeals: AppliedDeal[];
}

const OrderBasketContext = createContext<OrderBasketContextType | undefined>(undefined);

export const useOrderBasket = () => {
  const context = useContext(OrderBasketContext);
  if (!context) {
    throw new Error('useOrderBasket must be used within OrderBasketProvider');
  }
  return context;
};

export const OrderBasketProvider = ({ children }: { children: ReactNode }) => {
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
  const [isPaymentMode, setPaymentMode] = useState(false);
  const [splitBills, setSplitBills] = useState<number[]>([]);
  const [currentSplitIndex, setCurrentSplitIndex] = useState(0);
  const [orderAssignment, setOrderAssignment] = useState<OrderAssignment | null>(null);
  const [loadedOrderId, setLoadedOrderId] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [selectedItemsForPayment, setSelectedItemsForPayment] = useState<SelectedItemForPayment[]>([]);
  const [loadedAmountPaid, setLoadedAmountPaid] = useState<number>(0);
  const [appliedDeals, setAppliedDeals] = useState<AppliedDeal[]>([]);
  
  // Fetch deals for automatic discount calculation
  const { deals } = useDeals();

  const addToBasket = (
    menuItem: MenuItem, 
    unitPrice: number, 
    configuration?: BasketItem['configuration'],
    courseType?: CourseType,
    notes?: string
  ) => {
    // Infer course type from menu item's category_type if not explicitly provided
    const inferredCourseType: CourseType = courseType || (() => {
      if (!menuItem.category_type) return 'main';
      
      const typeMap: Record<string, CourseType> = {
        'drinks': 'drinks',
        'starters': 'starter',
        'mains': 'main',
        'desserts': 'dessert'
      };
      
      return typeMap[menuItem.category_type] || 'main';
    })();
    
    setBasketItems(prev => {
      // Check if exact same item with same configuration, ingredient modifications, AND notes exists
      const configKey = JSON.stringify({
        options: configuration?.selectedOptions || {},
        ingredients: configuration?.ingredientModifications || [],
        notes: notes || ''
      });
      const existingIndex = prev.findIndex(
        item => {
          const itemConfigKey = JSON.stringify({
            options: item.configuration?.selectedOptions || {},
            ingredients: item.configuration?.ingredientModifications || [],
            notes: item.notes || ''
          });
          return item.menuItem.id === menuItem.id && itemConfigKey === configKey;
        }
      );

      if (existingIndex >= 0) {
        // Increase quantity
        const updated = [...prev];
        const existing = updated[existingIndex];
        existing.quantity += 1;
        existing.totalPrice = existing.quantity * existing.unitPrice;
        return updated;
      } else {
        // Add new item
        const newItem: BasketItem = {
          id: `${menuItem.id}-${Date.now()}-${Math.random()}`,
          menuItem,
          quantity: 1,
          unitPrice,
          totalPrice: unitPrice,
          courseType: inferredCourseType,
          notes,
          configuration
        };
        return [...prev, newItem];
      }
    });
  };

  const updateQuantity = (basketItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromBasket(basketItemId);
      return;
    }
    setBasketItems(prev =>
      prev.map(item =>
        item.id === basketItemId
          ? { ...item, quantity: newQuantity, totalPrice: newQuantity * item.unitPrice }
          : item
      )
    );
  };

  const updateCourseType = (basketItemId: string, courseType: CourseType) => {
    setBasketItems(prev =>
      prev.map(item =>
        item.id === basketItemId ? { ...item, courseType } : item
      )
    );
  };

  const splitItemToDifferentCourse = (basketItemId: string, newCourseType: CourseType) => {
    setBasketItems(prev => {
      const itemIndex = prev.findIndex(item => item.id === basketItemId);
      if (itemIndex === -1) return prev;
      
      const item = prev[itemIndex];
      
      // If quantity is 1, just change course type (existing behavior)
      if (item.quantity === 1) {
        return prev.map(i => 
          i.id === basketItemId ? { ...i, courseType: newCourseType } : i
        );
      }
      
      // If quantity > 1, try to find existing item in target course to merge with
      const configKey = JSON.stringify({
        options: item.configuration?.selectedOptions || {},
        ingredients: item.configuration?.ingredientModifications || []
      });
      
      const existingTargetIndex = prev.findIndex(existingItem => {
        if (existingItem.id === basketItemId) return false; // Don't match self
        if (existingItem.courseType !== newCourseType) return false; // Must be in target course
        if (existingItem.menuItem.id !== item.menuItem.id) return false; // Must be same menu item
        
        const existingConfigKey = JSON.stringify({
          options: existingItem.configuration?.selectedOptions || {},
          ingredients: existingItem.configuration?.ingredientModifications || []
        });
        
        return configKey === existingConfigKey; // Must have same configuration
      });
      
      const updated = [...prev];
      
      // Reduce original item quantity by 1
      updated[itemIndex] = {
        ...item,
        quantity: item.quantity - 1,
        totalPrice: (item.quantity - 1) * item.unitPrice
      };
      
      if (existingTargetIndex >= 0) {
        // MERGE: Increase existing target item quantity by 1
        const existingTarget = updated[existingTargetIndex];
        updated[existingTargetIndex] = {
          ...existingTarget,
          quantity: existingTarget.quantity + 1,
          totalPrice: (existingTarget.quantity + 1) * existingTarget.unitPrice
        };
      } else {
        // CREATE NEW: No matching item exists in target course
        const splitItem: BasketItem = {
          id: `${item.menuItem.id}-${Date.now()}-${Math.random()}`,
          menuItem: item.menuItem,
          quantity: 1,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice,
          courseType: newCourseType,
          configuration: item.configuration
        };
        updated.push(splitItem);
      }
      
      return updated;
    });
  };

  const updateBasketItem = (
    basketItemId: string,
    newConfiguration: BasketItem['configuration'],
    newUnitPrice: number,
    newNotes?: string
  ) => {
    setBasketItems(prev => {
      const itemIndex = prev.findIndex(item => item.id === basketItemId);
      if (itemIndex === -1) return prev;
      
      const item = prev[itemIndex];
      
      // If quantity is 1, simply update the item in place
      if (item.quantity === 1) {
        const updated = [...prev];
        updated[itemIndex] = {
          ...item,
          configuration: newConfiguration,
          unitPrice: newUnitPrice,
          totalPrice: newUnitPrice,
          notes: newNotes
        };
        return updated;
      }
      
      // If quantity > 1, split off 1 item with new configuration
      // and keep (quantity - 1) with original configuration
      const updated = [...prev];
      
      // Reduce original item quantity by 1
      updated[itemIndex] = {
        ...item,
        quantity: item.quantity - 1,
        totalPrice: (item.quantity - 1) * item.unitPrice
      };
      
      // Create new item with edited configuration (quantity = 1)
      const editedItem: BasketItem = {
        id: `${item.menuItem.id}-${Date.now()}-${Math.random()}`,
        menuItem: item.menuItem,
        quantity: 1,
        unitPrice: newUnitPrice,
        totalPrice: newUnitPrice,
        courseType: item.courseType,
        notes: newNotes,
        configuration: newConfiguration
      };
      
      // Add the edited item to the basket
      updated.push(editedItem);
      
      return updated;
    });
  };

  const removeFromBasket = (basketItemId: string) => {
    setBasketItems(prev => prev.filter(item => item.id !== basketItemId));
  };

  const clearBasket = () => {
    setBasketItems([]);
    setOrderAssignment(null);
    setLoadedOrderId(null);
    setScheduledFor(null);
    setPaymentMode(false);
    setSplitBills([]);
    setCurrentSplitIndex(0);
    setSelectedItemsForPayment([]);
    setLoadedAmountPaid(0);
  };

  const toggleItemSelection = (basketItemId: string) => {
    setSelectedItemsForPayment(prev => {
      const item = basketItems.find(i => i.id === basketItemId);
      if (!item) return prev;
      
      // Calculate unpaid quantity first
      const unpaidQuantity = item.quantity - (item.quantityPaid || 0);
      
      // Prevent selection of fully paid items
      if (unpaidQuantity === 0) return prev;
      
      const existingIndex = prev.findIndex(s => s.basketItemId === basketItemId);
      
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        
        // Cycle through: 0 -> 1 -> 2 -> ... -> max -> 0
        if (existing.quantitySelected < unpaidQuantity) {
          // Increment selection
          return prev.map((s, idx) => 
            idx === existingIndex 
              ? { ...s, quantitySelected: s.quantitySelected + 1 }
              : s
          );
        } else {
          // Deselect (remove from array)
          return prev.filter((_, idx) => idx !== existingIndex);
        }
      } else {
        // First click - select 1 unit
        return [...prev, { basketItemId, quantitySelected: 1 }];
      }
    });
  };

  const clearSelectedItems = () => {
    setSelectedItemsForPayment([]);
  };

  const getSelectedItemsTotal = () => {
    return selectedItemsForPayment.reduce((sum, selected) => {
      const item = basketItems.find(i => i.id === selected.basketItemId);
      if (!item) return sum;
      return sum + (item.unitPrice * selected.quantitySelected);
    }, 0);
  };

  const applyDiscount = (basketItemId: string, discountPercentage: number) => {
    setBasketItems(prev => prev.map(item => {
      if (item.id !== basketItemId) return item;
      
      // Remove any price override when applying discount
      const effectiveUnitPrice = item.unitPrice;
      const discountedPrice = effectiveUnitPrice * (1 - discountPercentage / 100);
      
      return {
        ...item,
        discount: { type: 'percentage', value: discountPercentage },
        priceOverride: undefined,
        totalPrice: discountedPrice * item.quantity
      };
    }));
  };

  const applyPriceOverride = (basketItemId: string, newPrice: number) => {
    setBasketItems(prev => prev.map(item => {
      if (item.id !== basketItemId) return item;
      
      // Price override removes any discount
      return {
        ...item,
        priceOverride: newPrice,
        discount: undefined,
        totalPrice: newPrice * item.quantity
      };
    }));
  };

  const subtotal = basketItems.reduce((sum, item) => sum + item.totalPrice, 0);
  
  // Calculate discount based on active deals
  const dealCalculation = useMemo(() => {
    if (!deals || deals.length === 0 || basketItems.length === 0) {
      return { totalDiscount: 0, appliedDeals: [] };
    }
    return calculateAllDeals(basketItems, deals);
  }, [basketItems, deals]);

  const discount = dealCalculation.totalDiscount;
  
  // Update applied deals when calculation changes
  useEffect(() => {
    setAppliedDeals(dealCalculation.appliedDeals);
  }, [dealCalculation]);
  
  const amountPaid = basketItems.reduce((sum, item) => {
    return sum + (item.unitPrice * (item.quantityPaid || 0));
  }, 0) + loadedAmountPaid;
  const originalTotal = subtotal - discount; // Static total for payment completion checks
  const total = originalTotal - amountPaid;  // Dynamic remaining balance

  return (
    <OrderBasketContext.Provider
      value={{
        basketItems,
        setBasketItems,
        addToBasket,
        updateQuantity,
        updateCourseType,
        splitItemToDifferentCourse,
        updateBasketItem,
        applyDiscount,
        applyPriceOverride,
        removeFromBasket,
        clearBasket,
        subtotal,
        discount,
        amountPaid,
        total,
        originalTotal,
        isPaymentMode,
        setPaymentMode,
        splitBills,
        setSplitBills,
        currentSplitIndex,
        setCurrentSplitIndex,
        orderAssignment,
        setOrderAssignment,
        loadedOrderId,
        setLoadedOrderId,
        scheduledFor,
        setScheduledFor,
        selectedItemsForPayment,
        toggleItemSelection,
        clearSelectedItems,
        getSelectedItemsTotal,
        loadedAmountPaid,
        setLoadedAmountPaid,
        appliedDeals,
      }}
    >
      {children}
    </OrderBasketContext.Provider>
  );
};
