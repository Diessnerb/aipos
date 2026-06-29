import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export interface FieldSchema {
  name: string;
  label: string;
  type: 'number' | 'integer' | 'currency' | 'text' | 'textarea' | 'boolean' | 'select' | 'multiselect' | 'time' | 'date';
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
}

export interface DealType {
  id: string;
  company_id: string;
  key: string;
  name: string;
  description?: string;
  schema: {
    fields: FieldSchema[];
  };
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDealTypeData {
  key: string;
  name: string;
  description?: string;
  schema: {
    fields: FieldSchema[];
  };
}

export const useDealTypes = () => {
  const [dealTypes, setDealTypes] = useState<DealType[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, companyId } = useAuth();

  const fetchDealTypes = async () => {
    if (!user || !companyId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('deal_types')
        .select('*')
        .eq('company_id', companyId)
        .order('is_builtin', { ascending: false })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching deal types:', error);
        return;
      }

      setDealTypes((data || []).map(item => ({
        ...item,
        schema: item.schema as unknown as { fields: FieldSchema[] }
      })));
    } catch (error) {
      console.error('Error in fetchDealTypes:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDealType = async (dealTypeData: CreateDealTypeData) => {
    if (!user) throw new Error('Not authenticated');
    if (!companyId) throw new Error('Company ID missing from user');

    const { data, error } = await supabase
      .from('deal_types')
      .insert([{
        company_id: companyId,
        key: dealTypeData.key,
        name: dealTypeData.name,
        description: dealTypeData.description,
        schema: dealTypeData.schema as any,
        is_builtin: false
      } as any])
      .select()
      .single();

    if (error) {
      console.error('Error creating deal type:', error);
      throw error;
    }

    setDealTypes(prev => [...prev, {
      ...data,
      schema: data.schema as unknown as { fields: FieldSchema[] }
    } as DealType]);
    return data;
  };

  const generateDealType = async (description: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-deal-type', {
        body: { description }
      });

      if (error) {
        console.error('Error generating deal type:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in generateDealType:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchDealTypes();
  }, [user]);

  return {
    dealTypes,
    loading,
    createDealType,
    generateDealType,
    refetch: fetchDealTypes
  };
};