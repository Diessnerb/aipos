import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableGroup, CapacityScenario } from '@/types/table';
import { Calculator, Users, Target, TrendingUp } from 'lucide-react';

interface GroupCapacityVisualizerProps {
  group: TableGroup;
  tables: Table[];
  onCapacityChange: (capacity: number) => void;
}

export const GroupCapacityVisualizer = ({ 
  group, 
  tables, 
  onCapacityChange 
}: GroupCapacityVisualizerProps) => {
  const [scenarios, setScenarios] = useState<CapacityScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<CapacityScenario | null>(null);
  const [loading, setLoading] = useState(true);

  // Get tables that belong to this group
  const groupTables = tables.filter(table => 
    // This would normally come from group membership data
    table.can_combine && table.is_active
  );

  useEffect(() => {
    calculateAllScenarios();
  }, [groupTables]);

  const calculateAllScenarios = () => {
    setLoading(true);
    const allScenarios: CapacityScenario[] = [];

    // Generate all possible combinations of tables
    const generateCombinations = (arr: Table[], minSize: number = 2): Table[][] => {
      const combinations: Table[][] = [];
      
      const combine = (start: number, currentCombo: Table[]) => {
        if (currentCombo.length >= minSize) {
          combinations.push([...currentCombo]);
        }
        
        for (let i = start; i < arr.length; i++) {
          currentCombo.push(arr[i]);
          combine(i + 1, currentCombo);
          currentCombo.pop();
        }
      };
      
      combine(0, []);
      return combinations;
    };

    const combinations = generateCombinations(groupTables, 2);
    
    combinations.forEach(combo => {
      const scenario = calculateScenarioMetrics(combo);
      allScenarios.push(scenario);
    });

    // Sort by efficiency score
    allScenarios.sort((a, b) => b.efficiency_score - a.efficiency_score);
    
    // Mark the best scenario as optimal
    if (allScenarios.length > 0) {
      allScenarios[0].is_optimal = true;
      setSelectedScenario(allScenarios[0]);
      // Don't automatically trigger capacity change on load
    }

    setScenarios(allScenarios);
    setLoading(false);
  };

  const calculateScenarioMetrics = (tables: Table[]): CapacityScenario => {
    const totalIndividualSeats = tables.reduce((sum, table) => sum + table.seats, 0);
    
    // Calculate seat loss based on table connections
    let seatLoss = 0;
    if (tables.length === 2) {
      seatLoss = 2; // Standard loss for 2 tables
    } else if (tables.length === 3) {
      seatLoss = 4; // More loss for 3 tables
    } else if (tables.length >= 4) {
      seatLoss = tables.length * 1.5; // Increasing loss for more tables
    }
    
    const finalCapacity = Math.max(1, totalIndividualSeats - seatLoss);
    const efficiencyScore = (finalCapacity / totalIndividualSeats) * 100;
    
    // Calculate recommended party sizes (sweet spots)
    const recommendedSizes: number[] = [];
    const maxCapacity = finalCapacity;
    
    // Add efficient party sizes
    if (maxCapacity >= 4) recommendedSizes.push(4);
    if (maxCapacity >= 6) recommendedSizes.push(6);
    if (maxCapacity >= 8) recommendedSizes.push(8);
    if (maxCapacity >= 10) recommendedSizes.push(10);
    if (maxCapacity >= 12) recommendedSizes.push(12);
    
    // Always include the maximum
    if (!recommendedSizes.includes(maxCapacity)) {
      recommendedSizes.push(maxCapacity);
    }

    return {
      combination: tables.map(t => t.id),
      total_seats: finalCapacity,
      lost_seats: seatLoss,
      efficiency_score: Math.round(efficiencyScore),
      is_optimal: false,
      recommended_party_sizes: recommendedSizes.sort((a, b) => a - b),
    };
  };

  const getTableNames = (combination: string[]) => {
    return combination
      .map(id => {
        const table = tables.find(t => t.id === id);
        return table ? `Table ${table.table_number}` : 'Unknown';
      })
      .join(' + ');
  };

  const getEfficiencyColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEfficiencyBadgeVariant = (score: number) => {
    if (score >= 85) return 'default';
    if (score >= 70) return 'secondary';
    return 'destructive';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculating Capacity Scenarios...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Capacity Scenarios for {group.group_name}
        </CardTitle>
        {selectedScenario && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {selectedScenario.total_seats} seats optimal
            </Badge>
            <Badge variant={getEfficiencyBadgeVariant(selectedScenario.efficiency_score)}>
              {selectedScenario.efficiency_score}% efficiency
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="scenarios" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scenarios">All Scenarios</TabsTrigger>
            <TabsTrigger value="optimal">Optimal Setup</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>
          
          <TabsContent value="scenarios" className="space-y-3 mt-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {scenarios.map((scenario, index) => (
                <div
                  key={index}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedScenario === scenario
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => {
                    setSelectedScenario(scenario);
                    onCapacityChange(scenario.total_seats);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {getTableNames(scenario.combination)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {scenario.total_seats} seats ({scenario.lost_seats} lost)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={getEfficiencyBadgeVariant(scenario.efficiency_score)}
                        className="text-xs"
                      >
                        {scenario.efficiency_score}%
                      </Badge>
                      {scenario.is_optimal && (
                        <Badge variant="default" className="text-xs">
                          <Target className="h-3 w-3 mr-1" />
                          Optimal
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="optimal" className="space-y-4 mt-4">
            {selectedScenario && (
              <div className="space-y-4">
                <div className="p-4 border border-primary/20 rounded-lg bg-primary/5">
                  <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4" />
                    Optimal Configuration
                  </h3>
                  <p className="text-sm mb-3">
                    <strong>{getTableNames(selectedScenario.combination)}</strong>
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Capacity</p>
                      <p className="font-semibold text-lg">{selectedScenario.total_seats} seats</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Efficiency</p>
                      <p className={`font-semibold text-lg ${getEfficiencyColor(selectedScenario.efficiency_score)}`}>
                        {selectedScenario.efficiency_score}%
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Recommended Party Sizes
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedScenario.recommended_party_sizes.map(size => (
                      <Badge key={size} variant="secondary" className="text-xs">
                        {size} guests
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="analysis" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Efficiency Breakdown
                </h4>
                <div className="space-y-2">
                  {scenarios.slice(0, 3).map((scenario, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {scenario.combination.length} tables
                      </span>
                      <div className="flex items-center gap-2 w-32">
                        <Progress 
                          value={scenario.efficiency_score} 
                          className="flex-1 h-2" 
                        />
                        <span className="text-xs w-8 text-right">
                          {scenario.efficiency_score}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-3 border rounded-lg bg-muted/30">
                <h4 className="font-medium text-sm mb-2">Seat Loss Analysis</h4>
                <p className="text-xs text-muted-foreground">
                  When tables are combined, some seats are lost due to connection points 
                  and spacing requirements. The optimal scenario minimizes this loss 
                  while maximizing total capacity.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};