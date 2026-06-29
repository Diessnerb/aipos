import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCompanyId } from '@/hooks/useCompanyId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Wand2, Settings, HelpCircle, Play, BarChart3, History, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { RuleTemplateModal } from './RuleTemplateModal';
import { SimpleRuleBuilder } from './SimpleRuleBuilder';
import { AssignmentSetupWizard } from './AssignmentSetupWizard';
import { RuleHelpSystem } from './RuleHelpSystem';
import { RuleTestSimulator } from './RuleTestSimulator';
import { RuleEffectsDashboard } from './RuleEffectsDashboard';
import { AssignmentHistoryView } from './AssignmentHistoryView';
import type { AssignmentRule } from '@/types/table';

export function SimpleAssignmentRulesManager() {
  const { currentUser } = useCurrentUser();
  const { companyId: effectiveCompanyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [testingRule, setTestingRule] = useState<AssignmentRule | null>(null);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);
  const [activeView, setActiveView] = useState<'rules' | 'dashboard' | 'history'>('rules');

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['assignment-rules-simple', effectiveCompanyId],
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
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('assignment_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-rules-simple'] });
      toast.success('Rule updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update rule');
      console.error('Error updating rule:', error);
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
      queryClient.invalidateQueries({ queryKey: ['assignment-rules-simple'] });
      toast.success('Rule deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete rule');
      console.error('Error deleting rule:', error);
    },
  });

  const getRuleDescription = (rule: AssignmentRule): string => {
    const { rule_type, conditions, actions } = rule;
    
    switch (rule_type) {
      case 'time_based':
        const days = conditions.days_of_week || [];
        const timeRange = conditions.start_time && conditions.end_time 
          ? `${conditions.start_time}-${conditions.end_time}`
          : 'all day';
        const dayText = days.length > 0 ? days.join(', ') : 'every day';
        return `Automatically assigns tables during ${dayText} ${timeRange} with ${actions.score_modifier > 0 ? 'bonus' : 'standard'} priority`;
      
      case 'party_size':
        const minSize = conditions.min_party_size || 1;
        const maxSize = conditions.max_party_size || 12;
        const sizeText = minSize === maxSize ? `exactly ${minSize}` : `${minSize}-${maxSize}`;
        return `Gives ${actions.score_modifier > 0 ? 'better' : 'standard'} tables to groups of ${sizeText} people`;
      
      case 'customer_type':
        const types = conditions.customer_types || [];
        const typeLabels = types.map((t: string) => {
          const labels: Record<string, string> = {
            'vip': 'VIP customers',
            'repeat_customer': 'regular customers',
            'family_with_children': 'families with children',
            'accessibility_needs': 'customers with accessibility needs',
            'business_meeting': 'business meetings',
            'date_night': 'couples on date nights'
          };
          return labels[t] || t;
        });
        return `Automatically gives ${typeLabels.join(' and ')} ${actions.score_modifier > 0 ? 'premium' : 'appropriate'} seating`;
      
      case 'table_preference':
        const preferences = conditions.preferred_locations || [];
        const prefLabels = preferences.map((p: string) => {
          const labels: Record<string, string> = {
            'window': 'window seats',
            'quiet': 'quiet areas',
            'bar_area': 'bar area tables',
            'private': 'private sections',
            'accessible': 'accessible tables',
            'booth': 'booth seating'
          };
          return labels[p] || p;
        });
        return `Prioritises ${prefLabels.join(' and ')} when available`;
      
      default:
        return 'Custom seating rule that affects table assignments';
    }
  };

  const getRuleTypeLabel = (ruleType: string): string => {
    const labels = {
      'time_based': 'Time Rules',
      'party_size': 'Group Size Rules',
      'customer_type': 'VIP & Special Guests',
      'table_preference': 'Seating Preferences'
    };
    return labels[ruleType as keyof typeof labels] || 'Custom';
  };

  const getRulePriorityLabel = (priority: number): string => {
    if (priority >= 9) return 'Critical';
    if (priority >= 7) return 'Very Important';
    if (priority >= 5) return 'Important';
    if (priority >= 3) return 'Nice to Have';
    return 'Low Priority';
  };

  const getRuleImpactExample = (rule: AssignmentRule): string => {
    const { rule_type, conditions } = rule;
    
    switch (rule_type) {
      case 'time_based':
        return "Example: Friday evening reservations get window tables first";
      case 'party_size':
        return "Example: Groups of 4+ automatically get larger tables";
      case 'customer_type':
        const types = conditions.customer_types || [];
        if (types.includes('vip')) return "Example: VIP customers get Table 1-4 (best locations)";
        if (types.includes('family_with_children')) return "Example: Families get tables away from the bar";
        if (types.includes('accessibility_needs')) return "Example: Wheelchair users get accessible tables automatically";
        return "Example: Special customers get premium seating";
      case 'table_preference':
        const prefs = conditions.preferred_locations || [];
        if (prefs.includes('window')) return "Example: Customers prefer tables 5-8 (window views)";
        if (prefs.includes('quiet')) return "Example: Quiet tables 9-12 get priority for intimate dining";
        return "Example: Specific seating areas are preferred";
      default:
        return "Custom rule with specific seating logic";
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading your seating preferences...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Smart Seating System</h3>
          <p className="text-sm text-muted-foreground">
            Manage rules, see performance, and track how tables are assigned
          </p>
        </div>
        
        <div className="flex gap-1 bg-muted p-1 rounded-md">
          <Button
            variant={activeView === 'rules' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('rules')}
          >
            Rules
          </Button>
          <Button
            variant={activeView === 'dashboard' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('dashboard')}
          >
            Performance
          </Button>
          <Button
            variant={activeView === 'history' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveView('history')}
          >
            History
          </Button>
        </div>
      </div>

      {/* Rules View */}
      {activeView === 'rules' && (
        <>
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHelp(true)}
              className="gap-2"
            >
              <HelpCircle className="h-4 w-4" />
              Help
            </Button>
            
            {rules.length === 0 && (
              <Button
                onClick={() => setShowWizard(true)}
                className="gap-2"
              >
                <Wand2 className="h-4 w-4" />
                Quick Setup
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => setShowTemplates(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Template
            </Button>
            
            <Button
              onClick={() => setShowBuilder(true)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Custom Rule
            </Button>
          </div>

          {/* Rules List */}
          {rules.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <Wand2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No seating rules yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Get started with our quick setup wizard to create smart seating rules that work for your restaurant
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={() => setShowWizard(true)} className="gap-2">
                      <Wand2 className="h-4 w-4" />
                      Quick Setup Wizard
                    </Button>
                    <Button variant="outline" onClick={() => setShowTemplates(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Browse Templates
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {rules.map((rule) => (
                <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{rule.rule_name}</CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {getRuleTypeLabel(rule.rule_type)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getRulePriorityLabel(rule.priority)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getRuleDescription(rule)}
                        </p>
                        <p className="text-xs text-muted-foreground italic">
                          {getRuleImpactExample(rule)}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-3 ml-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={(checked) =>
                              toggleRuleMutation.mutate({ ruleId: rule.id, isActive: checked })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-xs text-muted-foreground">
                        Priority Level: {getRulePriorityLabel(rule.priority)} ({rule.priority}/10)
                      </div>
                      
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTestingRule(rule)}
                          className="gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Test Rule
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingRule(rule);
                            setShowBuilder(true);
                          }}
                          className="gap-2"
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRuleMutation.mutate(rule.id)}
                          className="text-destructive hover:text-destructive gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Dashboard View */}
      {activeView === 'dashboard' && (
        <RuleEffectsDashboard rules={rules} />
      )}

      {/* History View */}
      {activeView === 'history' && (
        <AssignmentHistoryView />
      )}

      {/* Modals */}
      <RuleTemplateModal 
        open={showTemplates} 
        onOpenChange={setShowTemplates} 
      />
      
      <SimpleRuleBuilder 
        open={showBuilder} 
        onOpenChange={(open) => {
          setShowBuilder(open);
          if (!open) setEditingRule(null);
        }}
        editingRule={editingRule}
        onEditComplete={() => {
          setEditingRule(null);
          setShowBuilder(false);
        }}
      />
      
      <AssignmentSetupWizard 
        open={showWizard} 
        onOpenChange={setShowWizard} 
      />
      
      <RuleHelpSystem 
        open={showHelp} 
        onOpenChange={setShowHelp} 
      />

      {/* Test Rule Modal */}
      {testingRule && (
        <Dialog open={!!testingRule} onOpenChange={() => setTestingRule(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Test Rule: {testingRule.rule_name}</DialogTitle>
            </DialogHeader>
            <RuleTestSimulator rule={testingRule} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}