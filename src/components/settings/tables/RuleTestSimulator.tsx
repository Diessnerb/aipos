import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { TimeSelectionModal } from '@/components/reservations/TimeSelectionModal';
import { Play, Users, Calendar, MapPin, Star, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { AssignmentRule, Table } from '@/types/table';
import { AssignmentRulesEngine } from '@/services/assignmentRulesEngine';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTablesQuery } from '@/hooks/useTablesQuery';

interface RuleTestSimulatorProps {
  rule: AssignmentRule;
}

interface TestScenario {
  partySize: number;
  customerType: string;
  time: string;
  day: string;
  notes: string;
}

interface SimulationResult {
  recommendedTables: Table[];
  scoreBreakdown: Array<{
    tableName: string;
    tableNumber: number;
    totalScore: number;
    reasons: string[];
    isRecommended: boolean;
  }>;
  ruleApplied: boolean;
  explanation: string;
}

export function RuleTestSimulator({ rule }: RuleTestSimulatorProps) {
  const { currentUser } = useCurrentUser();
  const { tables } = useTablesQuery();
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [scenario, setScenario] = useState<TestScenario>({
    partySize: 2,
    customerType: 'regular',
    time: '19:00',
    day: 'Friday',
    notes: ''
  });
  const [result, setResult] = useState<SimulationResult | null>(null);

  const testRuleMutation = useMutation({
    mutationFn: async (testScenario: TestScenario) => {
      if (!currentUser?.company_id) throw new Error('No company ID');

      const engine = new AssignmentRulesEngine(currentUser.company_id);
      
      // Create mock reservation
      const mockReservation = {
        id: 'test',
        party_size: testScenario.partySize,
        customer_name: 'Test Customer',
        email: 'test@example.com',
        date: new Date().toISOString().split('T')[0],
        time: testScenario.time,
        notes: `${testScenario.customerType === 'vip' ? 'VIP customer' : ''} ${testScenario.notes}`.trim(),
        phone: '1234567890',
        status: 'confirmed' as const,
        company_id: currentUser.company_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Create mock context
      const context = {
        reservation: mockReservation,
        availableTables: tables,
        tableGroups: [],
        currentTime: new Date(`2024-01-01 ${testScenario.time}`),
        companyId: currentUser.company_id
      };

      const result = await engine.evaluateAssignment(context);
      
      // Get detailed scoring for all tables
      const allScores = await Promise.all(
        tables.map(async (table) => {
          const score = await (engine as any).scoreTable(table, context);
          return {
            tableName: table.table_name || `Table ${table.table_number}`,
            tableNumber: table.table_number,
            totalScore: score.score,
            reasons: score.reasons,
            isRecommended: result.assignedTables?.includes(table.table_number) || false
          };
        })
      );

      return {
        recommendedTables: tables.filter(t => result.assignedTables?.includes(t.table_number)),
        scoreBreakdown: allScores.sort((a, b) => b.totalScore - a.totalScore),
        ruleApplied: result.appliedRules?.includes(rule.rule_name) || false,
        explanation: result.success 
          ? `Successfully assigned ${result.assignedTables?.join(', ')} with score ${result.score}`
          : result.error || 'No suitable assignment found'
      };
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error) => {
      toast.error('Failed to test rule');
      console.error('Rule test error:', error);
    },
  });

  const getCustomerTypeLabel = (type: string) => {
    const labels = {
      regular: 'Regular Customer',
      vip: 'VIP Customer',
      family: 'Family with Children',
      business: 'Business Meeting',
      date: 'Date Night',
      accessibility: 'Accessibility Needs'
    };
    return labels[type as keyof typeof labels] || 'Regular Customer';
  };

  const handleTest = () => {
    testRuleMutation.mutate(scenario);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Test "{rule.rule_name}" Rule
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            See exactly how this rule affects table assignments with different scenarios
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test Scenario Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Party Size</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={scenario.partySize}
                onChange={(e) => setScenario(prev => ({ ...prev, partySize: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div>
              <Label>Customer Type</Label>
              <Select value={scenario.customerType} onValueChange={(value) => setScenario(prev => ({ ...prev, customerType: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular Customer</SelectItem>
                  <SelectItem value="vip">VIP Customer</SelectItem>
                  <SelectItem value="family">Family with Children</SelectItem>
                  <SelectItem value="business">Business Meeting</SelectItem>
                  <SelectItem value="date">Date Night</SelectItem>
                  <SelectItem value="accessibility">Accessibility Needs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Time</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowTimeModal(true)}
                className="w-full justify-start text-left font-normal"
              >
                <Clock className="mr-2 h-4 w-4" />
                {scenario.time}
              </Button>
            </div>
            <div>
              <Label>Day</Label>
              <Select value={scenario.day} onValueChange={(value) => setScenario(prev => ({ ...prev, day: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monday">Monday</SelectItem>
                  <SelectItem value="Tuesday">Tuesday</SelectItem>
                  <SelectItem value="Wednesday">Wednesday</SelectItem>
                  <SelectItem value="Thursday">Thursday</SelectItem>
                  <SelectItem value="Friday">Friday</SelectItem>
                  <SelectItem value="Saturday">Saturday</SelectItem>
                  <SelectItem value="Sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Special Notes (Optional)</Label>
            <Textarea
              placeholder="e.g., wheelchair accessible, quiet table needed..."
              value={scenario.notes}
              onChange={(e) => setScenario(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <Button 
            onClick={handleTest} 
            className="w-full gap-2"
            disabled={testRuleMutation.isPending}
          >
            <Play className="h-4 w-4" />
            {testRuleMutation.isPending ? 'Testing...' : 'Test This Scenario'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Test Results</span>
              <Badge variant={result.ruleApplied ? 'default' : 'secondary'}>
                {result.ruleApplied ? 'Rule Applied' : 'Rule Not Applied'}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {scenario.partySize} people
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {scenario.day} at {scenario.time}
              </span>
              <span>{getCustomerTypeLabel(scenario.customerType)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recommended Tables */}
            {result.recommendedTables.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Recommended Assignment
                </h4>
                <div className="flex gap-2">
                  {result.recommendedTables.map((table) => (
                    <Badge key={table.id} variant="default" className="text-sm">
                      {table.table_name || `Table ${table.table_number}`} ({table.seats} seats)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-medium mb-2">What Happened?</h4>
              <p className="text-sm text-muted-foreground">{result.explanation}</p>
            </div>

            {/* Score Breakdown */}
            <div>
              <h4 className="font-medium mb-2">Score Breakdown for All Tables</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {result.scoreBreakdown.map((score) => (
                  <div 
                    key={score.tableNumber}
                    className={`p-3 rounded-md border ${
                      score.isRecommended ? 'bg-primary/5 border-primary' : 'bg-muted/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {score.tableName}
                        {score.isRecommended && <Star className="h-4 w-4 text-yellow-500" />}
                      </span>
                      <Badge variant={score.totalScore > 50 ? 'default' : 'secondary'}>
                        {score.totalScore} points
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {score.reasons.map((reason, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground">
                          • {reason}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <TimeSelectionModal
        isOpen={showTimeModal}
        onClose={() => setShowTimeModal(false)}
        onTimeSelect={(time) => setScenario(prev => ({ ...prev, time }))}
        currentTime={scenario.time}
      />
    </div>
  );
}