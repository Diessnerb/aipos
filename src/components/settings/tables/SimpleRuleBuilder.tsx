import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { TimeSelectionModal } from '@/components/reservations/TimeSelectionModal';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { AssignmentRule } from '@/types/table';

interface SimpleRuleBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule?: AssignmentRule | null;
  onEditComplete?: () => void;
}

interface RuleFormData {
  rule_name: string;
  rule_type: string;
  priority: number;
  conditions: Record<string, any>;
  actions: Record<string, any>;
}

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const CUSTOMER_TYPES = [
  { id: 'vip', label: 'VIP Customers', description: 'Regular customers marked as VIP' },
  { id: 'repeat_customer', label: 'Repeat Customers', description: 'Customers who visit frequently' },  
  { id: 'family_with_children', label: 'Families with Children', description: 'Groups with kids' },
  { id: 'accessibility_needs', label: 'Accessibility Needs', description: 'Customers requiring accessible seating' },
  { id: 'business_meeting', label: 'Business Meetings', description: 'Professional dining or meetings' },
  { id: 'date_night', label: 'Date Night', description: 'Romantic dining couples' }
];

const SEATING_PREFERENCES = [
  { id: 'window', label: 'Window Seats', description: 'Tables with a view' },
  { id: 'quiet', label: 'Quiet Area', description: 'Away from kitchen and bar' },
  { id: 'bar_area', label: 'Bar Area', description: 'Near the bar for casual dining' },
  { id: 'private', label: 'Private Section', description: 'Separate or secluded area' },
  { id: 'accessible', label: 'Accessible Tables', description: 'Wheelchair accessible' },
  { id: 'booth', label: 'Booth Seating', description: 'Comfortable booth tables' }
];

export function SimpleRuleBuilder({ 
  open, 
  onOpenChange, 
  editingRule, 
  onEditComplete 
}: SimpleRuleBuilderProps) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);
  const [formData, setFormData] = useState<RuleFormData>({
    rule_name: '',
    rule_type: '',
    priority: 5,
    conditions: {},
    actions: { score_modifier: 1 }
  });

  useEffect(() => {
    if (editingRule) {
      setFormData({
        rule_name: editingRule.rule_name,
        rule_type: editingRule.rule_type,
        priority: editingRule.priority,
        conditions: editingRule.conditions,
        actions: editingRule.actions
      });
      setStep(2); // Skip rule type selection when editing
    } else {
      resetForm();
    }
  }, [editingRule, open]);

  const resetForm = () => {
    setFormData({
      rule_name: '',
      rule_type: '',
      priority: 5,
      conditions: {},
      actions: { score_modifier: 1 }
    });
    setStep(1);
  };

  const createRuleMutation = useMutation({
    mutationFn: async (ruleData: RuleFormData) => {
      if (!currentUser?.company_id) throw new Error('No company ID');

      const { error } = await supabase
        .from('assignment_rules')
        .insert({
          company_id: currentUser.company_id,
          ...ruleData,
          is_active: true
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-rules-simple'] });
      toast.success('Rule created successfully!');
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to create rule');
      console.error('Error creating rule:', error);
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async (ruleData: RuleFormData) => {
      if (!editingRule) throw new Error('No rule to update');

      const { error } = await supabase
        .from('assignment_rules')
        .update(ruleData)
        .eq('id', editingRule.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-rules-simple'] });
      toast.success('Rule updated successfully!');
      onOpenChange(false);
      onEditComplete?.();
    },
    onError: (error) => {
      toast.error('Failed to update rule');
      console.error('Error updating rule:', error);
    },
  });

  const handleSubmit = () => {
    if (!formData.rule_name.trim()) {
      toast.error('Please enter a rule name');
      return;
    }

    if (editingRule) {
      updateRuleMutation.mutate(formData);
    } else {
      createRuleMutation.mutate(formData);
    }
  };

  const updateConditions = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      conditions: { ...prev.conditions, [key]: value }
    }));
  };

  const renderRuleTypeSelection = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">What type of rule do you want to create?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose the main factor that should influence table assignments
        </p>
      </div>

      <div className="grid gap-3">
        {[
          { 
            id: 'time_based', 
            title: 'Time-Based Rules', 
            description: 'Different seating during specific hours or days'
          },
          { 
            id: 'party_size', 
            title: 'Group Size Rules', 
            description: 'Seating based on number of people'
          },
          { 
            id: 'customer_type', 
            title: 'Customer Type Rules', 
            description: 'Special treatment for VIPs, families, etc.'
          },
          { 
            id: 'table_preference', 
            title: 'Seating Preferences', 
            description: 'Prefer specific areas like window seats or quiet zones'
          }
        ].map((option) => (
          <Card 
            key={option.id} 
            className={`cursor-pointer transition-colors ${
              formData.rule_type === option.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
            }`}
            onClick={() => setFormData(prev => ({ ...prev, rule_type: option.id }))}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  formData.rule_type === option.id 
                    ? 'bg-primary border-primary' 
                    : 'border-muted-foreground'
                }`} />
                <div>
                  <h4 className="font-medium">{option.title}</h4>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderRuleConfiguration = () => (
    <div className="space-y-6">
      <div>
        <Label htmlFor="rule_name">Rule Name</Label>
        <Input
          id="rule_name"
          value={formData.rule_name}
          onChange={(e) => setFormData(prev => ({ ...prev, rule_name: e.target.value }))}
          placeholder="e.g., VIP Customer Priority"
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Give your rule a clear, memorable name
        </p>
      </div>

      <Separator />

      {formData.rule_type === 'time_based' && (
        <div className="space-y-4">
          <h4 className="font-medium">When should this rule apply?</h4>
          
          <div>
            <Label>Days of the Week</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="flex items-center space-x-2">
                  <Switch
                    checked={(formData.conditions.days_of_week || []).includes(day)}
                    onCheckedChange={(checked) => {
                      const currentDays = formData.conditions.days_of_week || [];
                      const newDays = checked
                        ? [...currentDays, day]
                        : currentDays.filter((d: string) => d !== day);
                      updateConditions('days_of_week', newDays);
                    }}
                  />
                  <Label className="text-sm">{day}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time">Start Time</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowStartTimeModal(true)}
                className="w-full justify-start text-left font-normal mt-1"
              >
                <Clock className="mr-2 h-4 w-4" />
                {formData.conditions.start_time || 'Select time'}
              </Button>
            </div>
            <div>
              <Label htmlFor="end_time">End Time</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEndTimeModal(true)}
                className="w-full justify-start text-left font-normal mt-1"
              >
                <Clock className="mr-2 h-4 w-4" />
                {formData.conditions.end_time || 'Select time'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {formData.rule_type === 'party_size' && (
        <div className="space-y-4">
          <h4 className="font-medium">What group sizes should this rule apply to?</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="min_party_size">Minimum Group Size</Label>
              <Input
                id="min_party_size"
                type="number"
                min="1"
                max="20"
                value={formData.conditions.min_party_size || 1}
                onChange={(e) => updateConditions('min_party_size', parseInt(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="max_party_size">Maximum Group Size</Label>
              <Input
                id="max_party_size"
                type="number"
                min="1"
                max="20"
                value={formData.conditions.max_party_size || 12}
                onChange={(e) => updateConditions('max_party_size', parseInt(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      )}

      {formData.rule_type === 'customer_type' && (
        <div className="space-y-4">
          <h4 className="font-medium">Which customer types should this rule apply to?</h4>
          
          <div className="space-y-3">
            {CUSTOMER_TYPES.map((type) => (
              <div key={type.id} className="flex items-center space-x-2">
                <Switch
                  checked={(formData.conditions.customer_types || []).includes(type.id)}
                  onCheckedChange={(checked) => {
                    const currentTypes = formData.conditions.customer_types || [];
                    const newTypes = checked
                      ? [...currentTypes, type.id]
                      : currentTypes.filter((t: string) => t !== type.id);
                    updateConditions('customer_types', newTypes);
                  }}
                />
                <div>
                  <Label className="text-sm font-medium">{type.label}</Label>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {formData.rule_type === 'table_preference' && (
        <div className="space-y-4">
          <h4 className="font-medium">Which seating areas should be preferred?</h4>
          
          <div className="space-y-3">
            {SEATING_PREFERENCES.map((pref) => (
              <div key={pref.id} className="flex items-center space-x-2">
                <Switch
                  checked={(formData.conditions.preferred_locations || []).includes(pref.id)}
                  onCheckedChange={(checked) => {
                    const currentPrefs = formData.conditions.preferred_locations || [];
                    const newPrefs = checked
                      ? [...currentPrefs, pref.id]
                      : currentPrefs.filter((p: string) => p !== pref.id);
                    updateConditions('preferred_locations', newPrefs);
                  }}
                />
                <div>
                  <Label className="text-sm font-medium">{pref.label}</Label>
                  <p className="text-xs text-muted-foreground">{pref.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      <div>
        <Label>Rule Priority</Label>
        <div className="mt-2">
          <Slider
            value={[formData.priority]}
            onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value[0] }))}
            max={10}
            min={1}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Low Priority (1)</span>
            <span>Current: {formData.priority}</span>
            <span>High Priority (10)</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Higher priority rules are applied first when multiple rules match
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRule ? 'Edit Seating Rule' : 'Create Custom Seating Rule'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {editingRule 
              ? 'Modify your existing seating rule'
              : step === 1 
                ? 'Step 1 of 2: Choose the type of rule you want to create'
                : 'Step 2 of 2: Configure your rule details'
            }
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {!editingRule && step === 1 ? renderRuleTypeSelection() : renderRuleConfiguration()}
        </div>

        <div className="flex justify-between pt-4">
          {!editingRule && step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            
            {!editingRule && step === 1 ? (
              <Button 
                onClick={() => setStep(2)}
                disabled={!formData.rule_type}
              >
                Next
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
              >
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
      
      <TimeSelectionModal
        isOpen={showStartTimeModal}
        onClose={() => setShowStartTimeModal(false)}
        onTimeSelect={(time) => updateConditions('start_time', time)}
        currentTime={formData.conditions.start_time || '00:00'}
      />
      
      <TimeSelectionModal
        isOpen={showEndTimeModal}
        onClose={() => setShowEndTimeModal(false)}
        onTimeSelect={(time) => updateConditions('end_time', time)}
        currentTime={formData.conditions.end_time || '23:59'}
      />
    </Dialog>
  );
}