import React, { useState } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { TimeSelectionModal } from '@/components/reservations/TimeSelectionModal';
import { Wand2, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface AssignmentSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface WizardData {
  restaurantType: string[];
  busyHours: { start: string; end: string };
  specialCustomers: string[];
  seatingPreferences: string[];
  priorities: string[];
}

const RESTAURANT_TYPES = [
  { id: 'fine_dining', label: 'Fine Dining', description: 'Upscale restaurant with table service' },
  { id: 'casual_dining', label: 'Casual Dining', description: 'Relaxed atmosphere, family-friendly' },
  { id: 'fast_casual', label: 'Fast Casual', description: 'Quick service with quality food' },
  { id: 'bar_restaurant', label: 'Bar & Restaurant', description: 'Bar with full food menu' },
  { id: 'cafe', label: 'Café', description: 'Coffee shop with light meals' }
];

const SPECIAL_CUSTOMERS = [
  { id: 'vip', label: 'VIP/Regular Customers', description: 'Customers you want to give special treatment' },
  { id: 'business', label: 'Business Diners', description: 'Professional meetings and corporate dining' },
  { id: 'families', label: 'Families with Children', description: 'Parents dining with kids' },
  { id: 'dates', label: 'Romantic Dining', description: 'Couples on date nights' },
  { id: 'accessibility', label: 'Accessibility Needs', description: 'Customers requiring accessible seating' }
];

const SEATING_AREAS = [
  { id: 'window', label: 'Window Seats', description: 'Tables with views' },
  { id: 'quiet', label: 'Quiet Section', description: 'Away from kitchen and bar noise' },
  { id: 'bar_area', label: 'Bar Area', description: 'High-top tables near the bar' },
  { id: 'private', label: 'Private Dining', description: 'Separate or secluded area' },
  { id: 'outdoor', label: 'Outdoor Seating', description: 'Patio or terrace tables' }
];

const PRIORITIES = [
  { id: 'customer_satisfaction', label: 'Customer Satisfaction', description: 'Prioritise guest experience over efficiency' },
  { id: 'table_turnover', label: 'Table Turnover', description: 'Maximise seating efficiency during busy times' },
  { id: 'ambiance', label: 'Maintain Ambiance', description: 'Keep the atmosphere pleasant for all guests' },
  { id: 'staff_efficiency', label: 'Staff Efficiency', description: 'Make it easier for servers to manage tables' }
];

export function AssignmentSetupWizard({ open, onOpenChange }: AssignmentSetupWizardProps) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData>({
    restaurantType: [],
    busyHours: { start: '18:00', end: '21:00' },
    specialCustomers: [],
    seatingPreferences: [],
    priorities: []
  });

  const createRulesMutation = useMutation({
    mutationFn: async (data: WizardData) => {
      if (!currentUser?.company_id) throw new Error('No company ID');

      const rules = [];

      // Create time-based rule for busy hours
      if (data.busyHours.start && data.busyHours.end) {
        rules.push({
          company_id: currentUser.company_id,
          rule_name: 'Busy Hours Management',
          rule_type: 'time_based',
          conditions: {
            days_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            start_time: data.busyHours.start,
            end_time: data.busyHours.end
          },
          actions: { score_modifier: 2 },
          priority: 8,
          is_active: true
        });
      }

      // Create customer type rules
      if (data.specialCustomers.includes('vip')) {
        rules.push({
          company_id: currentUser.company_id,
          rule_name: 'VIP Customer Priority',
          rule_type: 'customer_type',
          conditions: { customer_types: ['vip', 'repeat_customer'] },
          actions: { score_modifier: 3 },
          priority: 9,
          is_active: true
        });
      }

      if (data.specialCustomers.includes('families')) {
        rules.push({
          company_id: currentUser.company_id,
          rule_name: 'Family-Friendly Seating',
          rule_type: 'customer_type',
          conditions: { customer_types: ['family_with_children'] },
          actions: { score_modifier: 2 },
          priority: 7,
          is_active: true
        });
      }

      if (data.specialCustomers.includes('accessibility')) {
        rules.push({
          company_id: currentUser.company_id,
          rule_name: 'Accessibility Priority',
          rule_type: 'customer_type',
          conditions: { customer_types: ['accessibility_needs'] },
          actions: { score_modifier: 5 },
          priority: 10,
          is_active: true
        });
      }

      if (data.specialCustomers.includes('dates')) {
        rules.push({
          company_id: currentUser.company_id,
          rule_name: 'Romantic Seating',
          rule_type: 'party_size',
          conditions: { min_party_size: 2, max_party_size: 2 },
          actions: { score_modifier: 2 },
          priority: 6,
          is_active: true
        });
      }

      if (data.specialCustomers.includes('business')) {
        rules.push({
          company_id: currentUser.company_id,
          rule_name: 'Business Lunch Setup',
          rule_type: 'time_based',
          conditions: {
            days_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            start_time: '12:00',
            end_time: '14:00'
          },
          actions: { score_modifier: 2 },
          priority: 6,
          is_active: true
        });
      }

      // Create table preference rules
      if (data.seatingPreferences.length > 0) {
        rules.push({
          company_id: currentUser.company_id,
          rule_name: 'Preferred Seating Areas',
          rule_type: 'table_preference',
          conditions: { preferred_locations: data.seatingPreferences },
          actions: { score_modifier: 2 },
          priority: 5,
          is_active: true
        });
      }

      // Large party management (common for most restaurants)
      rules.push({
        company_id: currentUser.company_id,
        rule_name: 'Large Party Management',
        rule_type: 'party_size',
        conditions: { min_party_size: 6, max_party_size: 12 },
        actions: { score_modifier: 2 },
        priority: 7,
        is_active: true
      });

      // Insert all rules
      const { error } = await supabase
        .from('assignment_rules')
        .insert(rules);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-rules-simple'] });
      toast.success('Setup complete! Your seating rules are now active.');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to complete setup');
      console.error('Error creating rules:', error);
    },
  });

  const updateWizardData = (key: keyof WizardData, value: any) => {
    setWizardData(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayItem = (key: keyof WizardData, item: string) => {
    const currentArray = wizardData[key] as string[];
    const newArray = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item];
    updateWizardData(key, newArray);
  };

  const handleComplete = () => {
    createRulesMutation.mutate(wizardData);
  };

  const progress = (step / 5) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Smart Seating Setup Wizard
          </DialogTitle>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Step {step} of 5: Let's set up seating rules that work perfectly for your restaurant
            </p>
            <Progress value={progress} className="h-2" />
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">What type of restaurant do you run?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This helps us suggest the best seating strategies for your business
                </p>
              </div>
              
              <div className="space-y-3">
                {RESTAURANT_TYPES.map((type) => (
                  <Card key={type.id} className="cursor-pointer hover:bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={wizardData.restaurantType.includes(type.id)}
                          onCheckedChange={() => toggleArrayItem('restaurantType', type.id)}
                        />
                        <div>
                          <Label className="font-medium cursor-pointer">{type.label}</Label>
                          <p className="text-sm text-muted-foreground">{type.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">When are your busiest hours?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We'll create special rules to handle high-traffic periods efficiently
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="busy_start">Busy period starts</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowStartTimeModal(true)}
                    className="w-full justify-start text-left font-normal mt-1"
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {wizardData.busyHours.start}
                  </Button>
                </div>
                <div>
                  <Label htmlFor="busy_end">Busy period ends</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEndTimeModal(true)}
                    className="w-full justify-start text-left font-normal mt-1"
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {wizardData.busyHours.end}
                  </Button>
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg">
                <p className="text-sm">
                  <strong>Example:</strong> If you selected 6:00 PM - 9:00 PM, we'll create rules to optimize 
                  table assignments during your dinner rush for better flow and faster turnover.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Do you serve any of these customer types?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We'll create special seating rules for each type you select
                </p>
              </div>

              <div className="space-y-3">
                {SPECIAL_CUSTOMERS.map((customer) => (
                  <Card key={customer.id} className="cursor-pointer hover:bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={wizardData.specialCustomers.includes(customer.id)}
                          onCheckedChange={() => toggleArrayItem('specialCustomers', customer.id)}
                        />
                        <div>
                          <Label className="font-medium cursor-pointer">{customer.label}</Label>
                          <p className="text-sm text-muted-foreground">{customer.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">What seating areas do you have?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We'll help you prioritize these areas for different types of guests
                </p>
              </div>

              <div className="space-y-3">
                {SEATING_AREAS.map((area) => (
                  <Card key={area.id} className="cursor-pointer hover:bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={wizardData.seatingPreferences.includes(area.id)}
                          onCheckedChange={() => toggleArrayItem('seatingPreferences', area.id)}
                        />
                        <div>
                          <Label className="font-medium cursor-pointer">{area.label}</Label>
                          <p className="text-sm text-muted-foreground">{area.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">What matters most to your restaurant?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This helps us fine-tune the rules to match your priorities
                </p>
              </div>

              <div className="space-y-3">
                {PRIORITIES.map((priority) => (
                  <Card key={priority.id} className="cursor-pointer hover:bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={wizardData.priorities.includes(priority.id)}
                          onCheckedChange={() => toggleArrayItem('priorities', priority.id)}
                        />
                        <div>
                          <Label className="font-medium cursor-pointer">{priority.label}</Label>
                          <p className="text-sm text-muted-foreground">{priority.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="bg-primary/10 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium text-primary">Ready to create your rules!</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Based on your answers, we'll create {3 + wizardData.specialCustomers.length} seating rules 
                      that you can customize later if needed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button 
            variant="outline" 
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
          >
            Back
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            
            {step < 5 ? (
              <Button onClick={() => setStep(step + 1)}>
                Next
              </Button>
            ) : (
              <Button 
                onClick={handleComplete}
                disabled={createRulesMutation.isPending}
                className="gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {createRulesMutation.isPending ? 'Creating Rules...' : 'Complete Setup'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
      
      <TimeSelectionModal
        isOpen={showStartTimeModal}
        onClose={() => setShowStartTimeModal(false)}
        onTimeSelect={(time) => updateWizardData('busyHours', { ...wizardData.busyHours, start: time })}
        currentTime={wizardData.busyHours.start}
      />
      
      <TimeSelectionModal
        isOpen={showEndTimeModal}
        onClose={() => setShowEndTimeModal(false)}
        onTimeSelect={(time) => updateWizardData('busyHours', { ...wizardData.busyHours, end: time })}
        currentTime={wizardData.busyHours.end}
      />
    </Dialog>
  );
}