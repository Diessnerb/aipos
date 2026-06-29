import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

interface CreateRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RULE_TYPES = [
  { value: 'time_based', label: 'Time Based', description: 'Rules based on time of day or day of week' },
  { value: 'party_size', label: 'Party Size', description: 'Rules based on reservation party size' },
  { value: 'customer_type', label: 'Customer Type', description: 'Rules for VIP or accessibility needs' },
  { value: 'table_preference', label: 'Table Preference', description: 'Rules for specific table types or locations' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const CreateRuleModal: React.FC<CreateRuleModalProps> = ({ open, onOpenChange }) => {
  const [formData, setFormData] = useState({
    rule_name: '',
    rule_type: '',
    priority: 5,
    conditions: {} as any,
    actions: { score_modifier: 0 } as any,
  });

  const { currentUser } = useCurrentUser();
  const { companyId: effectiveCompanyId } = useCompanyId();
  const queryClient = useQueryClient();

  const createRuleMutation = useMutation({
    mutationFn: async (ruleData: any) => {
      if (!effectiveCompanyId) throw new Error('No company ID');
      
      const { error } = await supabase
        .from('assignment_rules')
        .insert({
          ...ruleData,
          company_id: effectiveCompanyId,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-rules'] });
      toast.success('Rule created successfully');
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Error creating rule:', error);
      toast.error('Failed to create rule');
    },
  });

  const resetForm = () => {
    setFormData({
      rule_name: '',
      rule_type: '',
      priority: 5,
      conditions: {},
      actions: { score_modifier: 0 },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.rule_name || !formData.rule_type) {
      toast.error('Please fill in all required fields');
      return;
    }

    createRuleMutation.mutate(formData);
  };

  const updateConditions = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      conditions: { ...prev.conditions, [key]: value }
    }));
  };

  const updateActions = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      actions: { ...prev.actions, [key]: value }
    }));
  };

  const renderConditionsForm = () => {
    switch (formData.rule_type) {
      case 'time_based':
        return (
          <div className="space-y-4">
            <div>
              <Label>Hours (0-23)</Label>
              <div className="grid grid-cols-6 gap-2 mt-2">
                {Array.from({ length: 24 }, (_, i) => (
                  <label key={i} className="flex items-center space-x-1">
                    <Checkbox
                      checked={formData.conditions.hours?.includes(i) || false}
                      onCheckedChange={(checked) => {
                        const hours = formData.conditions.hours || [];
                        if (checked) {
                          updateConditions('hours', [...hours, i]);
                        } else {
                          updateConditions('hours', hours.filter((h: number) => h !== i));
                        }
                      }}
                    />
                    <span className="text-sm">{i}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Days of Week</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {DAYS_OF_WEEK.map(day => (
                  <label key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                      checked={formData.conditions.days?.includes(day.value) || false}
                      onCheckedChange={(checked) => {
                        const days = formData.conditions.days || [];
                        if (checked) {
                          updateConditions('days', [...days, day.value]);
                        } else {
                          updateConditions('days', days.filter((d: number) => d !== day.value));
                        }
                      }}
                    />
                    <span className="text-sm">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'party_size':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="min_size">Minimum Party Size</Label>
              <Input
                id="min_size"
                type="number"
                min="1"
                value={formData.conditions.min_size || ''}
                onChange={(e) => updateConditions('min_size', parseInt(e.target.value) || undefined)}
              />
            </div>
            <div>
              <Label htmlFor="max_size">Maximum Party Size</Label>
              <Input
                id="max_size"
                type="number"
                min="1"
                value={formData.conditions.max_size || ''}
                onChange={(e) => updateConditions('max_size', parseInt(e.target.value) || undefined)}
              />
            </div>
          </div>
        );

      case 'customer_type':
        return (
          <div className="space-y-4">
            <label className="flex items-center space-x-2">
              <Checkbox
                checked={formData.conditions.vip_only || false}
                onCheckedChange={(checked) => updateConditions('vip_only', checked)}
              />
              <span>VIP Customers Only</span>
            </label>
            <label className="flex items-center space-x-2">
              <Checkbox
                checked={formData.conditions.accessibility_required || false}
                onCheckedChange={(checked) => updateConditions('accessibility_required', checked)}
              />
              <span>Accessibility Required</span>
            </label>
          </div>
        );

      case 'table_preference':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="preferred_locations">Preferred Locations (comma-separated)</Label>
              <Input
                id="preferred_locations"
                value={formData.conditions.preferred_locations?.join(', ') || ''}
                onChange={(e) => {
                  const locations = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  updateConditions('preferred_locations', locations.length > 0 ? locations : undefined);
                }}
                placeholder="e.g., patio, window, bar"
              />
            </div>
            <div>
              <Label htmlFor="table_types">Preferred Table Types (comma-separated)</Label>
              <Input
                id="table_types"
                value={formData.conditions.table_types?.join(', ') || ''}
                onChange={(e) => {
                  const types = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  updateConditions('table_types', types.length > 0 ? types : undefined);
                }}
                placeholder="e.g., booth, high-top, round"
              />
            </div>
          </div>
        );

      default:
        return <div className="text-muted-foreground">Select a rule type to configure conditions</div>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Assignment Rule</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rule_name">Rule Name *</Label>
              <Input
                id="rule_name"
                value={formData.rule_name}
                onChange={(e) => setFormData(prev => ({ ...prev, rule_name: e.target.value }))}
                placeholder="e.g., Peak Hours Priority"
                required
              />
            </div>
            <div>
              <Label htmlFor="rule_type">Rule Type *</Label>
              <Select
                value={formData.rule_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, rule_type: value, conditions: {} }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rule type" />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Priority (1-10)</Label>
            <div className="mt-2">
              <Slider
                value={[formData.priority]}
                onValueChange={([value]) => setFormData(prev => ({ ...prev, priority: value }))}
                max={10}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Low (1)</span>
                <span>Current: {formData.priority}</span>
                <span>High (10)</span>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Conditions</CardTitle>
              <CardDescription>
                Define when this rule should be applied
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderConditionsForm()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>
                Define what happens when this rule matches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label>Score Modifier</Label>
                <div className="mt-2">
                  <Slider
                    value={[formData.actions.score_modifier]}
                    onValueChange={([value]) => updateActions('score_modifier', value)}
                    max={50}
                    min={-50}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Penalty (-50)</span>
                    <span>Current: {formData.actions.score_modifier}</span>
                    <span>Bonus (+50)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createRuleMutation.isPending}>
              {createRuleMutation.isPending ? 'Creating...' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};