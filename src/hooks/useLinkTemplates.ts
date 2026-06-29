import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LinkTemplate, TemplateOption } from '@/types/linkTemplates';
import { useToast } from '@/hooks/use-toast';

export const useLinkTemplates = (companyId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['link-templates', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('link_templates')
        .select('*')
        .eq('company_id', companyId as string)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(template => ({
        ...template,
        link_structure_json: template.link_structure_json as unknown as TemplateOption[],
      })) as LinkTemplate[];
    },
    enabled: !!companyId,
  });

  const saveTemplate = useMutation({
    mutationFn: async ({
      templateName,
      templateOptions,
    }: {
      templateName: string;
      templateOptions: TemplateOption[];
    }) => {
      if (!companyId) {
        throw new Error('No company selected. Please try again.');
      }
      const { data, error } = await supabase
        .from('link_templates')
        .insert([
          {
            template_name: templateName,
            link_structure_json: templateOptions,
            company_id: companyId,
          } as any,
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['link-templates', companyId] });
      toast({
        title: 'Template saved successfully',
        description: `"${data.template_name}" has been saved to your template library.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error saving template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('link_templates')
        .delete()
        .eq('id', templateId)
        .eq('company_id', companyId as string);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['link-templates', companyId] });
      toast({ title: 'Template deleted successfully' });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    templates,
    isLoading,
    saveTemplate: saveTemplate.mutateAsync,
    deleteTemplate: deleteTemplate.mutateAsync,
  };
};
