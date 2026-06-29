import React from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, Star, MapPin, Utensils, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface RuleTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  rule_type: string;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  priority: number;
}

const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'rush-hour',
    name: 'Rush Hour Seating',
    description: 'During busy dinner hours (6-9 PM), prioritize faster table turnover by seating guests at bar-height tables and avoiding window seats for large groups.',
    icon: <Clock className="h-5 w-5" />,
    category: 'Time Management',
    rule_type: 'time_based',
    conditions: {
      days_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      start_time: '18:00',
      end_time: '21:00'
    },
    actions: {
      score_modifier: 2
    },
    priority: 8
  },
  {
    id: 'vip-priority',
    name: 'VIP Customer Priority',
    description: 'Automatically give VIP customers and repeat visitors the best available tables with window views and quieter locations.',
    icon: <Star className="h-5 w-5" />,
    category: 'Customer Service',
    rule_type: 'customer_type',
    conditions: {
      customer_types: ['vip', 'repeat_customer']
    },
    actions: {
      score_modifier: 3
    },
    priority: 9
  },
  {
    id: 'large-party',
    name: 'Large Party Management',
    description: 'Groups of 6+ people get seated in the back section or private dining area to maintain ambiance for other guests.',
    icon: <Users className="h-5 w-5" />,
    category: 'Group Management',
    rule_type: 'party_size',
    conditions: {
      min_party_size: 6,
      max_party_size: 12
    },
    actions: {
      score_modifier: 2
    },
    priority: 7
  },
  {
    id: 'accessibility-first',
    name: 'Accessibility Priority',
    description: 'Guests with accessibility needs automatically get wheelchair-accessible tables near the entrance and restrooms.',
    icon: <MapPin className="h-5 w-5" />,
    category: 'Accessibility',
    rule_type: 'customer_type',
    conditions: {
      customer_types: ['accessibility_needs']
    },
    actions: {
      score_modifier: 5
    },
    priority: 10
  },
  {
    id: 'window-romantic',
    name: 'Romantic Window Seating',
    description: 'Couples on date nights get priority for window tables with the best views, especially during evening hours.',
    icon: <MapPin className="h-5 w-5" />,
    category: 'Ambiance',
    rule_type: 'party_size',
    conditions: {
      min_party_size: 2,
      max_party_size: 2
    },
    actions: {
      score_modifier: 2
    },
    priority: 6
  },
  {
    id: 'family-friendly',
    name: 'Family Seating',
    description: 'Families with children get tables near restrooms and away from the bar area for everyone\'s comfort.',
    icon: <Users className="h-5 w-5" />,
    category: 'Family Service',
    rule_type: 'customer_type',
    conditions: { 
      customer_types: ['family_with_children']
    },
    actions: {
      score_modifier: 2
    },
    priority: 7
  },
  {
    id: 'lunch-business',
    name: 'Business Lunch Setup',
    description: 'During lunch hours (12-2 PM), business customers get quieter tables suitable for meetings and conversations.',
    icon: <Utensils className="h-5 w-5" />,
    category: 'Business',
    rule_type: 'time_based',
    conditions: {
      days_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      start_time: '12:00',
      end_time: '14:00'
    },
    actions: {
      score_modifier: 2
    },
    priority: 6
  },
  {
    id: 'weekend-brunch',
    name: 'Weekend Brunch Flow',
    description: 'Weekend brunch guests get tables with good natural light and proximity to coffee station for a relaxed experience.',
    icon: <Calendar className="h-5 w-5" />,
    category: 'Time Management',
    rule_type: 'time_based',
    conditions: {
      days_of_week: ['Saturday', 'Sunday'],
      start_time: '09:00',
      end_time: '14:00'
    },
    actions: {
      score_modifier: 2
    },
    priority: 5
  }
];

export function RuleTemplateModal({ open, onOpenChange }: RuleTemplateModalProps) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const createRuleMutation = useMutation({
    mutationFn: async (template: RuleTemplate) => {
      if (!currentUser?.company_id) throw new Error('No company ID');

      const { error } = await supabase
        .from('assignment_rules')
        .insert({
          company_id: currentUser.company_id,
          rule_name: template.name,
          rule_type: template.rule_type,
          conditions: template.conditions,
          actions: template.actions,
          priority: template.priority,
          is_active: true
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-rules-simple'] });
      toast.success('Template added successfully!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to add template');
      console.error('Error creating rule from template:', error);
    },
  });

  const handleSelectTemplate = (template: RuleTemplate) => {
    createRuleMutation.mutate(template);
  };

  const categories = [...new Set(RULE_TEMPLATES.map(t => t.category))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose a Seating Rule Template</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select from pre-built rules that work great for most restaurants. You can customize them later.
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                {category}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {RULE_TEMPLATES
                  .filter(template => template.category === category)
                  .map((template) => (
                    <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-primary/10 text-primary">
                            {template.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-sm">{template.name}</CardTitle>
                              <Badge variant="outline" className="text-xs">
                                Priority {template.priority}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {template.description}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        <Button
                          onClick={() => handleSelectTemplate(template)}
                          disabled={createRuleMutation.isPending}
                          size="sm"
                          className="w-full"
                        >
                          {createRuleMutation.isPending ? 'Adding...' : 'Use This Template'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}