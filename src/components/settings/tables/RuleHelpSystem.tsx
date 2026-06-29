import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  HelpCircle, 
  Clock, 
  Users, 
  Star, 
  MapPin,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  ArrowRight
} from 'lucide-react';

interface RuleHelpSystemProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HELP_SECTIONS = {
  overview: {
    title: 'How Smart Seating Works',
    icon: <Lightbulb className="h-5 w-5" />,
    content: [
      {
        title: 'Automatic Table Assignment',
        description: 'When a reservation is made, the system automatically finds the best available table based on your rules.',
        example: 'A VIP customer books for 7 PM → System automatically assigns them a window table'
      },
      {
        title: 'Rule Priority System',
        description: 'Rules with higher priority (8-10) are applied first. This ensures your most important preferences are never overridden.',
        example: 'Accessibility needs (Priority 10) always beats VIP preference (Priority 9)'
      },
      {
        title: 'Multiple Rule Matching',
        description: 'When multiple rules apply to the same reservation, they work together to find the perfect table.',
        example: 'A VIP couple on Friday night gets both romantic seating AND priority treatment'
      }
    ]
  },
  rules: {
    title: 'Understanding Rule Types',
    icon: <Clock className="h-5 w-5" />,
    content: [
      {
        title: 'Time-Based Rules',
        description: 'Apply different seating strategies during specific hours or days of the week.',
        example: 'During lunch (12-2 PM), prioritize quick-turn tables near the bar. During dinner (6-9 PM), focus on creating intimate dining experiences.'
      },
      {
        title: 'Group Size Rules',
        description: 'Handle different party sizes with appropriate seating arrangements.',
        example: 'Couples (2 people) get romantic window seats. Large groups (6+ people) get spacious corner booths.'
      },
      {
        title: 'Customer Type Rules',
        description: 'Give special treatment to different types of customers.',
        example: 'VIP customers automatically get the best available table. Families with children get tables near restrooms.'
      },
      {
        title: 'Seating Preference Rules',
        description: 'Prioritize specific areas of your restaurant based on the situation.',
        example: 'Business meetings get quiet tables away from the bar. Date nights get intimate window seating.'
      }
    ]
  },
  examples: {
    title: 'Real Restaurant Examples',
    icon: <Star className="h-5 w-5" />,
    content: [
      {
        title: 'Fine Dining Restaurant',
        description: 'Focus on creating memorable experiences with personalized seating.',
        example: 'Rule 1: VIP customers get chef\'s table or window seats (Priority 9)\nRule 2: Couples get intimate corner booths during dinner (Priority 7)\nRule 3: Business diners get quiet tables during lunch (Priority 6)'
      },
      {
        title: 'Family Restaurant',
        description: 'Balance family needs with efficient service.',
        example: 'Rule 1: Families with children get tables near restrooms and play area (Priority 8)\nRule 2: High chairs automatically assigned to families with toddlers (Priority 9)\nRule 3: Loud groups get tables away from quiet diners (Priority 6)'
      },
      {
        title: 'Busy Café',
        description: 'Maximise turnover while maintaining customer satisfaction.',
        example: 'Rule 1: During rush hours (8-10 AM), prioritise counter seating (Priority 8)\nRule 2: Students with laptops get tables with power outlets (Priority 5)\nRule 3: Large groups get communal tables (Priority 7)'
      }
    ]
  },
  tips: {
    title: 'Best Practices & Tips',
    icon: <CheckCircle className="h-5 w-5" />,
    content: [
      {
        title: 'Start Simple',
        description: 'Begin with 3-5 basic rules and add more as you see what works.',
        example: 'Start with: VIP priority, Large group management, Rush hour efficiency. Add customer-specific rules later.'
      },
      {
        title: 'Set Clear Priorities', 
        description: 'Use priority levels strategically. Reserve 9-10 for critical needs like accessibility.',
        example: 'Priority 10: Accessibility needs\nPriority 9: VIP customers\nPriority 8: Rush hour management\nPriority 5-7: General preferences'
      },
      {
        title: 'Monitor and Adjust',
        description: 'Review your rules monthly and adjust based on customer feedback and staff observations.',
        example: 'If VIP customers complain about seating, increase their rule priority. If rush hour is chaotic, create more specific time-based rules.'
      },
      {
        title: 'Train Your Staff',
        description: 'Make sure your team understands the seating rules so they can override when necessary.',
        example: 'Staff should know that wheelchair users always get accessible tables, even if it means moving other reservations.'
      }
    ]
  }
};

const COMMON_SCENARIOS = [
  {
    scenario: 'VIP customer wants a table during rush hour',
    solution: 'VIP rule (Priority 9) overrides rush hour rule (Priority 8)',
    result: 'VIP gets best available table despite busy period'
  },
  {
    scenario: 'Large party of 8 books during dinner time', 
    solution: 'Large party rule combines with time-based rule',
    result: 'Group gets spacious seating in quieter section'
  },
  {
    scenario: 'Couple with wheelchair accessibility needs',
    solution: 'Accessibility rule (Priority 10) takes precedence over all others',
    result: 'Accessible table assigned immediately, other rules ignored'
  }
];

export function RuleHelpSystem({ open, onOpenChange }: RuleHelpSystemProps) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Smart Seating Help Center
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Everything you need to know about creating effective seating rules
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            {Object.entries(HELP_SECTIONS).map(([key, section]) => (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                {section.icon}
                <span className="hidden sm:inline">{section.title.split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(HELP_SECTIONS).map(([key, section]) => (
            <TabsContent key={key} value={key} className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
              </div>

              <div className="grid gap-4">
                {section.content.map((item, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-primary" />
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                      <div className="bg-muted/30 p-3 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Badge variant="secondary" className="text-xs">Example</Badge>
                        </div>
                        <p className="text-xs mt-2 whitespace-pre-line">
                          {item.example}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}

          <TabsContent value="scenarios" className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Common Scenarios</h3>
              <p className="text-sm text-muted-foreground mb-4">
                See how rules work together in real situations
              </p>
            </div>

            <div className="space-y-4">
              {COMMON_SCENARIOS.map((scenario, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-sm">Scenario</h4>
                          <p className="text-sm text-muted-foreground">{scenario.scenario}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-sm">How Rules Apply</h4>
                          <p className="text-sm text-muted-foreground">{scenario.solution}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-sm">Result</h4>
                          <p className="text-sm text-muted-foreground">{scenario.result}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            Need more help? Contact support for personalised assistance.
          </div>
          <Button onClick={() => onOpenChange(false)}>
            Got it, thanks!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}