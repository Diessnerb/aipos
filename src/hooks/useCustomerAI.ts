import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CustomerContext {
  customerName?: string;
  phone?: string;
  email?: string;
  visitHistory?: any[];
  preferences?: any;
}

export const useCustomerAI = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const getCustomerHelp = async (query: string, context: CustomerContext) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-ai', {
        body: { query, context }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Customer AI error:', error);
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

  const findCustomer = async (searchQuery: string) => {
    return getCustomerHelp(`Find customer: ${searchQuery}`, {});
  };

  const suggestPreferences = async (context: CustomerContext) => {
    return getCustomerHelp('Suggest customer preferences based on history', context);
  };

  const draftMessage = async (context: CustomerContext, purpose: string) => {
    return getCustomerHelp(`Draft a ${purpose} message for this customer`, context);
  };

  return {
    isProcessing,
    getCustomerHelp,
    findCustomer,
    suggestPreferences,
    draftMessage,
  };
};
