import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface InventoryContext {
  itemName?: string;
  currentStock?: number;
  averageUsage?: number;
  lowStockItems?: any[];
  salesData?: any[];
}

export const useInventoryAI = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const getInventoryHelp = async (query: string, context: InventoryContext) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('inventory-ai', {
        body: { query, context }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Inventory AI error:', error);
      toast({
        title: 'AI Error',
        description: 'Failed to get AI assistance',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const suggestReorder = async (context: InventoryContext) => {
    return getInventoryHelp('Suggest reorder quantity and timing', context);
  };

  const findAlternatives = async (itemName: string) => {
    return getInventoryHelp(`Suggest alternatives for ${itemName}`, { itemName });
  };

  const optimizeMenu = async (context: InventoryContext) => {
    return getInventoryHelp('Suggest menu changes based on inventory levels', context);
  };

  const predictDemand = async (context: InventoryContext) => {
    return getInventoryHelp('Predict upcoming demand based on patterns', context);
  };

  return {
    isProcessing,
    getInventoryHelp,
    suggestReorder,
    findAlternatives,
    optimizeMenu,
    predictDemand,
  };
};
