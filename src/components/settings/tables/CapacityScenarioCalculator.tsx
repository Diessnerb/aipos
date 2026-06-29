import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Table, CapacityScenario } from '@/types/table';
import { Calculator, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CapacityScenarioCalculatorProps {
  tables: Table[];
  onScenarioSelect: (scenario: CapacityScenario) => void;
  selectedTables: string[];
  calculateCapacity?: () => Promise<{ success: boolean; message: string; scenarios: any[] }>;
}

export const CapacityScenarioCalculator = ({
  tables,
  onScenarioSelect,
  selectedTables,
  calculateCapacity
}: CapacityScenarioCalculatorProps) => {
  const [targetPartySize, setTargetPartySize] = useState<number>(8);
  const [scenarios, setScenarios] = useState<CapacityScenario[]>([]);
  const [optimalScenario, setOptimalScenario] = useState<CapacityScenario | null>(null);
  const [seatLossPerConnection, setSeatLossPerConnection] = useState<number>(2);

  const workingTables = tables.filter(table => 
    selectedTables.includes(table.id) && table.can_combine && table.is_active
  );

  useEffect(() => {
    if (workingTables.length >= 2) {
      calculateScenarios();
    }
  }, [workingTables, targetPartySize, seatLossPerConnection]);

  const calculateScenarios = () => {
    const allScenarios: CapacityScenario[] = [];
    
    // Generate all possible combinations
    const generateCombinations = (arr: Table[]): Table[][] => {
      const result: Table[][] = [];
      
      // Helper function to generate combinations of specific length
      const combine = (arr: Table[], length: number): Table[][] => {
        if (length === 1) {
          return arr.map(item => [item]);
        }
        
        const combinations: Table[][] = [];
        for (let i = 0; i <= arr.length - length; i++) {
          const head = arr[i];
          const tailCombinations = combine(arr.slice(i + 1), length - 1);
          for (const tail of tailCombinations) {
            combinations.push([head, ...tail]);
          }
        }
        return combinations;
      };
      
      // Generate combinations of length 2 to n
      for (let i = 2; i <= Math.min(arr.length, 6); i++) {
        result.push(...combine(arr, i));
      }
      
      return result;
    };

    const combinations = generateCombinations(workingTables);
    
    combinations.forEach(combo => {
      const scenario = calculateScenarioMetrics(combo);
      allScenarios.push(scenario);
    });

    // Sort scenarios by how close they are to target party size and efficiency
    allScenarios.sort((a, b) => {
      const aTargetDiff = Math.abs(a.total_seats - targetPartySize);
      const bTargetDiff = Math.abs(b.total_seats - targetPartySize);
      
      // If both are close to target, prefer higher efficiency
      if (aTargetDiff === bTargetDiff) {
        return b.efficiency_score - a.efficiency_score;
      }
      
      // Prefer closer to target party size
      return aTargetDiff - bTargetDiff;
    });

    // Mark optimal scenarios
    if (allScenarios.length > 0) {
      allScenarios[0].is_optimal = true;
      setOptimalScenario(allScenarios[0]);
    }

    setScenarios(allScenarios.slice(0, 5)); // Show top 5 scenarios
  };

  const calculateScenarioMetrics = (tables: Table[]): CapacityScenario => {
    const totalIndividualSeats = tables.reduce((sum, table) => sum + table.seats, 0);
    
    // Calculate connections (each additional table creates one connection)
    const connections = tables.length - 1;
    const totalSeatLoss = connections * seatLossPerConnection;
    
    const finalCapacity = Math.max(1, totalIndividualSeats - totalSeatLoss);
    const efficiencyScore = Math.round((finalCapacity / totalIndividualSeats) * 100);
    
    // Generate recommended party sizes around the capacity
    const recommendedSizes: number[] = [];
    const baseSize = Math.floor(finalCapacity * 0.7); // 70% capacity
    const maxSize = finalCapacity;
    
    for (let size = Math.max(4, baseSize); size <= maxSize; size += 2) {
      recommendedSizes.push(size);
    }
    
    if (!recommendedSizes.includes(maxSize)) {
      recommendedSizes.push(maxSize);
    }

    return {
      combination: tables.map(t => t.id),
      total_seats: finalCapacity,
      lost_seats: totalSeatLoss,
      efficiency_score: efficiencyScore,
      is_optimal: false,
      recommended_party_sizes: recommendedSizes,
    };
  };

  const getTableNames = (combination: string[]) => {
    return combination
      .map(id => {
        const table = tables.find(t => t.id === id);
        return table ? `T${table.table_number}` : '?';
      })
      .join('+');
  };

  const getScenarioRating = (scenario: CapacityScenario) => {
    const targetDiff = Math.abs(scenario.total_seats - targetPartySize);
    const efficiency = scenario.efficiency_score;
    
    if (targetDiff === 0 && efficiency >= 85) return 'excellent';
    if (targetDiff <= 2 && efficiency >= 75) return 'good';
    if (targetDiff <= 4 && efficiency >= 60) return 'fair';
    return 'poor';
  };

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'excellent': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'good': return <Zap className="h-4 w-4 text-blue-600" />;
      case 'fair': return <Calculator className="h-4 w-4 text-yellow-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'border-green-200 bg-green-50';
      case 'good': return 'border-blue-200 bg-blue-50';
      case 'fair': return 'border-yellow-200 bg-yellow-50';
      default: return 'border-red-200 bg-red-50';
    }
  };

  const handleSelectScenario = (scenario: CapacityScenario) => {
    onScenarioSelect(scenario);
    toast.success(`Selected ${getTableNames(scenario.combination)} - ${scenario.total_seats} seats`);
  };

  const findBestForPartySize = () => {
    const bestScenario = scenarios.find(s => 
      s.total_seats >= targetPartySize && s.total_seats <= targetPartySize + 2
    ) || scenarios[0];
    
    if (bestScenario) {
      handleSelectScenario(bestScenario);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Capacity Calculator
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Calculate optimal table combinations for your target party size
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="target-party-size">Target Party Size</Label>
            <Input
              id="target-party-size"
              type="number"
              value={targetPartySize}
              onChange={(e) => setTargetPartySize(Number(e.target.value))}
              min={2}
              max={20}
            />
          </div>
          <div className="space-y-2">
            <Label>Seat Loss Per Connection: {seatLossPerConnection}</Label>
            <Slider
              value={[seatLossPerConnection]}
              onValueChange={(value) => setSeatLossPerConnection(value[0])}
              max={5}
              min={1}
              step={0.5}
              className="pt-2"
            />
          </div>
        </div>

        {workingTables.length < 2 && (
          <div className="p-3 border border-yellow-200 rounded-lg bg-yellow-50">
            <p className="text-sm text-yellow-800">
              Select at least 2 tables to see capacity scenarios
            </p>
          </div>
        )}

        {scenarios.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Recommended Scenarios</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={findBestForPartySize}
                disabled={!optimalScenario}
              >
                <Zap className="h-4 w-4 mr-2" />
                Use Optimal
              </Button>
            </div>

            <div className="space-y-2">
              {scenarios.map((scenario, index) => {
                const rating = getScenarioRating(scenario);
                const targetDiff = Math.abs(scenario.total_seats - targetPartySize);
                
                return (
                  <div
                    key={index}
                    className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${getRatingColor(rating)}`}
                    onClick={() => handleSelectScenario(scenario)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getRatingIcon(rating)}
                        <div>
                          <p className="font-medium text-sm">
                            {getTableNames(scenario.combination)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {scenario.total_seats} seats capacity
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {scenario.is_optimal && (
                          <Badge variant="default" className="text-xs">
                            Optimal
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {scenario.efficiency_score}% efficient
                        </Badge>
                        {targetDiff === 0 && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            Perfect Match
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-muted-foreground">
                        Lost: {scenario.lost_seats} seats
                      </span>
                      <span className={`font-medium ${
                        targetDiff === 0 ? 'text-green-600' : 
                        targetDiff <= 2 ? 'text-blue-600' : 'text-muted-foreground'
                      }`}>
                        {targetDiff === 0 ? 'Exact match' : `±${targetDiff} from target`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {optimalScenario && (
          <div className="p-3 border border-primary/20 rounded-lg bg-primary/5">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Smart Recommendation
            </h4>
            <p className="text-xs text-muted-foreground">
              For {targetPartySize} guests, use <strong>{getTableNames(optimalScenario.combination)}</strong> 
              {' '}({optimalScenario.total_seats} seats, {optimalScenario.efficiency_score}% efficiency)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};