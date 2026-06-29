import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PermissionTemplate {
  id: string;
  template_name: string;
  created_at: string;
  updated_at: string;
}

export const usePermissionTemplates = () => {
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_permission_templates')
        .select('id, template_name, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Error",
        description: "Failed to fetch permission templates",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const saveTemplate = useCallback(async (templateName: string) => {
    try {
      const { data, error } = await supabase.rpc('save_company_permission_template', {
        p_template_name: templateName
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save template');
      }

      toast({
        title: "Success",
        description: result.message || "Template saved successfully"
      });

      await fetchTemplates();
      return true;
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save template",
        variant: "destructive"
      });
      return false;
    }
  }, [toast, fetchTemplates]);

  const loadTemplate = useCallback(async (templateId: string) => {
    try {
      const { data, error } = await supabase.rpc('load_company_permission_template', {
        p_template_id: templateId
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load template');
      }

      toast({
        title: "Success",
        description: result.message || "Template loaded successfully"
      });

      return true;
    } catch (error) {
      console.error('Error loading template:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load template",
        variant: "destructive"
      });
      return false;
    }
  }, [toast]);

  const resetToSystemDefaults = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('reset_to_system_defaults');

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to reset to system defaults');
      }

      toast({
        title: "Success",
        description: result.message || "Reset to system defaults successfully"
      });

      return true;
    } catch (error) {
      console.error('Error resetting to system defaults:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reset to system defaults",
        variant: "destructive"
      });
      return false;
    }
  }, [toast]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('company_permission_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template deleted successfully"
      });

      await fetchTemplates();
      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive"
      });
      return false;
    }
  }, [toast, fetchTemplates]);

  return {
    templates,
    loading,
    fetchTemplates,
    saveTemplate,
    loadTemplate,
    resetToSystemDefaults,
    deleteTemplate
  };
};