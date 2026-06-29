import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Play, Pause } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";
import { CreateRuleModal } from "./CreateRuleModal";
import { EditRuleModal } from "./EditRuleModal";
import { AssignmentRule } from "@/types/table";

export const AssignmentRulesManager: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);
  const { currentUser } = useCurrentUser();
  const { companyId: effectiveCompanyId } = useCompanyId();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['assignment-rules', effectiveCompanyId],
    queryFn: async () => {
      if (!effectiveCompanyId) return [];
      
      const { data, error } = await supabase
        .from('assignment_rules')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .order('priority', { ascending: false });
      
      if (error) throw error;
      return data as AssignmentRule[];
    },
    enabled: !!effectiveCompanyId,
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('assignment_rules')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', ruleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-rules'] });
      toast.success('Rule updated successfully');
    },
    onError: (error) => {
      console.error('Error updating rule:', error);
      toast.error('Failed to update rule');
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from('assignment_rules')
        .delete()
        .eq('id', ruleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-rules'] });
      toast.success('Rule deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    },
  });

  const getRuleTypeColor = (ruleType: string) => {
    switch (ruleType) {
      case 'time_based': return 'bg-blue-100 text-blue-800';
      case 'party_size': return 'bg-green-100 text-green-800';
      case 'customer_type': return 'bg-purple-100 text-purple-800';
      case 'table_preference': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRuleConditions = (conditions: any, ruleType: string) => {
    switch (ruleType) {
      case 'time_based':
        const hours = conditions.hours ? `Hours: ${conditions.hours.join(', ')}` : '';
        const days = conditions.days ? `Days: ${conditions.days.map((d: number) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}` : '';
        return [hours, days].filter(Boolean).join(' | ');
      
      case 'party_size':
        const min = conditions.min_size ? `Min: ${conditions.min_size}` : '';
        const max = conditions.max_size ? `Max: ${conditions.max_size}` : '';
        const exact = conditions.exact_sizes ? `Exact: ${conditions.exact_sizes.join(', ')}` : '';
        return [min, max, exact].filter(Boolean).join(' | ');
      
      case 'customer_type':
        const vip = conditions.vip_only ? 'VIP Only' : '';
        const accessibility = conditions.accessibility_required ? 'Accessibility Required' : '';
        return [vip, accessibility].filter(Boolean).join(' | ');
      
      case 'table_preference':
        const locations = conditions.preferred_locations ? `Locations: ${conditions.preferred_locations.join(', ')}` : '';
        const types = conditions.table_types ? `Types: ${conditions.table_types.join(', ')}` : '';
        return [locations, types].filter(Boolean).join(' | ');
      
      default:
        return 'Complex conditions';
    }
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading assignment rules...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Assignment Rules</h3>
          <p className="text-sm text-muted-foreground">
            Configure intelligent table assignment rules based on time, party size, and preferences
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <div className="grid gap-4">
        {rules.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Rules Configured</CardTitle>
              <CardDescription>
                Create your first assignment rule to enable intelligent table assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowCreateModal(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create First Rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className={`${rule.is_active ? '' : 'opacity-60'}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium">{rule.rule_name}</h4>
                    <Badge className={getRuleTypeColor(rule.rule_type)}>
                      {rule.rule_type.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline">
                      Priority: {rule.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) =>
                        toggleRuleMutation.mutate({ ruleId: rule.id, isActive: checked })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingRule(rule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRuleMutation.mutate(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Conditions: </span>
                    <span className="text-sm text-muted-foreground">
                      {formatRuleConditions(rule.conditions, rule.rule_type)}
                    </span>
                  </div>
                  {rule.actions.score_modifier && (
                    <div>
                      <span className="text-sm font-medium">Score Modifier: </span>
                      <span className="text-sm text-muted-foreground">
                        {rule.actions.score_modifier > 0 ? '+' : ''}{rule.actions.score_modifier}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreateRuleModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />

      {editingRule && (
        <EditRuleModal
          rule={editingRule}
          open={!!editingRule}
          onOpenChange={(open) => !open && setEditingRule(null)}
        />
      )}
    </div>
  );
};