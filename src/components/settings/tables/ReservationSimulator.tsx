import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableArrangement, SeatPosition } from '@/types/table';
import { Calendar, Users, Clock, Play, RotateCcw, TrendingUp } from 'lucide-react';

interface ReservationSimulatorProps {
  tables: Table[];
  arrangements: TableArrangement[];
  seatPositions: Record<string, SeatPosition[]>;
  onAssignmentTest: (results: AssignmentTestResult[]) => void;
}

interface MockReservation {
  id: string;
  partySize: number;
  time: string;
  preferences: string[];
  accessibility: boolean;
}

interface AssignmentTestResult {
  reservation: MockReservation;
  assignedTables: string[];
  efficiency: number;
  conflicts: string[];
  success: boolean;
}

const MOCK_RESERVATIONS: MockReservation[] = [
  { id: '1', partySize: 2, time: '18:00', preferences: ['quiet'], accessibility: false },
  { id: '2', partySize: 4, time: '18:30', preferences: ['window'], accessibility: false },
  { id: '3', partySize: 6, time: '19:00', preferences: [], accessibility: true },
  { id: '4', partySize: 8, time: '19:30', preferences: ['private'], accessibility: false },
  { id: '5', partySize: 3, time: '20:00', preferences: [], accessibility: false },
  { id: '6', partySize: 5, time: '20:30', preferences: ['quiet'], accessibility: false },
];

export const ReservationSimulator = ({
  tables,
  arrangements,
  seatPositions,
  onAssignmentTest
}: ReservationSimulatorProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<AssignmentTestResult[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<'peak_time' | 'mixed_sizes' | 'accessibility_focus'>('peak_time');
  const [simulationProgress, setSimulationProgress] = useState(0);

  const getScenarioReservations = (scenario: string): MockReservation[] => {
    switch (scenario) {
      case 'peak_time':
        return MOCK_RESERVATIONS.slice(0, 4); // Heavy booking period
      case 'mixed_sizes':
        return MOCK_RESERVATIONS.filter(r => [2, 4, 8].includes(r.partySize));
      case 'accessibility_focus':
        return MOCK_RESERVATIONS.map(r => ({ ...r, accessibility: Math.random() > 0.7 }));
      default:
        return MOCK_RESERVATIONS;
    }
  };

  const simulateTableAssignment = (reservation: MockReservation): AssignmentTestResult => {
    const availableCapacity = Object.entries(seatPositions).reduce((acc, [tableId, seats]) => {
      const availableSeats = seats.filter(s => s.seat_status === 'available').length;
      const table = tables.find(t => t.id === tableId);
      if (table && availableSeats > 0) {
        acc[tableId] = {
          seats: availableSeats,
          table: table,
          accessibility: seats.some(s => s.is_accessible && s.seat_status === 'available')
        };
      }
      return acc;
    }, {} as Record<string, { seats: number; table: Table; accessibility: boolean }>);

    // Simple assignment algorithm
    const conflicts: string[] = [];
    let assignedTables: string[] = [];
    let totalAssignedSeats = 0;

    // Sort tables by seat count (try to minimize table usage)
    const sortedTables = Object.entries(availableCapacity)
      .sort(([, a], [, b]) => b.seats - a.seats);

    for (const [tableId, capacity] of sortedTables) {
      if (totalAssignedSeats >= reservation.partySize) break;

      // Check accessibility requirements
      if (reservation.accessibility && !capacity.accessibility) {
        continue;
      }

      // Check preferences
      if (reservation.preferences.includes('quiet') && !capacity.table.is_quiet_area) {
        conflicts.push(`Table ${capacity.table.table_number} doesn't meet quiet preference`);
      }
      if (reservation.preferences.includes('window') && !capacity.table.window_seating) {
        conflicts.push(`Table ${capacity.table.table_number} doesn't have window seating`);
      }

      assignedTables.push(tableId);
      totalAssignedSeats += capacity.seats;
    }

    const success = totalAssignedSeats >= reservation.partySize;
    const efficiency = success ? (reservation.partySize / totalAssignedSeats) * 100 : 0;

    if (!success) {
      conflicts.push(`Insufficient capacity: needed ${reservation.partySize}, available ${totalAssignedSeats}`);
    }

    return {
      reservation,
      assignedTables,
      efficiency: Math.round(efficiency),
      conflicts,
      success
    };
  };

  const runSimulation = async () => {
    setIsRunning(true);
    setSimulationProgress(0);
    setTestResults([]);

    const scenarioReservations = getScenarioReservations(selectedScenario);
    const results: AssignmentTestResult[] = [];

    for (let i = 0; i < scenarioReservations.length; i++) {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result = simulateTableAssignment(scenarioReservations[i]);
      results.push(result);
      setTestResults([...results]);
      setSimulationProgress(((i + 1) / scenarioReservations.length) * 100);
    }

    setIsRunning(false);
    onAssignmentTest(results);
  };

  const resetSimulation = () => {
    setTestResults([]);
    setSimulationProgress(0);
  };

  const getResultStatusColor = (result: AssignmentTestResult) => {
    if (!result.success) return 'text-red-600';
    if (result.efficiency >= 80) return 'text-green-600';
    if (result.efficiency >= 60) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getResultStatusBadge = (result: AssignmentTestResult) => {
    if (!result.success) return 'destructive';
    if (result.efficiency >= 80) return 'default';
    return 'secondary';
  };

  const overallStats = testResults.length > 0 ? {
    successRate: Math.round((testResults.filter(r => r.success).length / testResults.length) * 100),
    averageEfficiency: Math.round(testResults.reduce((sum, r) => sum + r.efficiency, 0) / testResults.length),
    totalConflicts: testResults.reduce((sum, r) => sum + r.conflicts.length, 0)
  } : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Reservation Assignment Simulator
        </CardTitle>
        <div className="flex items-center gap-4">
          <Select value={selectedScenario} onValueChange={(value: any) => setSelectedScenario(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="peak_time">Peak Time Rush</SelectItem>
              <SelectItem value="mixed_sizes">Mixed Party Sizes</SelectItem>
              <SelectItem value="accessibility_focus">Accessibility Focus</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={runSimulation} 
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {isRunning ? 'Running...' : 'Run Simulation'}
          </Button>
          <Button 
            variant="outline" 
            onClick={resetSimulation}
            disabled={isRunning}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress Bar */}
        {isRunning && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Simulation Progress</span>
              <span>{Math.round(simulationProgress)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${simulationProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Overall Statistics */}
        {overallStats && (
          <div className="grid grid-cols-3 gap-4 mb-6 p-4 border rounded-lg bg-muted/20">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Success Rate</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{overallStats.successRate}%</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Avg Efficiency</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{overallStats.averageEfficiency}%</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Issues</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">{overallStats.totalConflicts}</p>
            </div>
          </div>
        )}

        {/* Test Results */}
        <div className="space-y-3">
          {testResults.map((result, index) => (
            <div 
              key={result.reservation.id}
              className="border rounded-lg p-4 bg-background"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{result.reservation.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{result.reservation.partySize} guests</span>
                  </div>
                  {result.reservation.accessibility && (
                    <Badge variant="outline" className="text-xs">Accessible</Badge>
                  )}
                </div>
                <Badge variant={getResultStatusBadge(result)}>
                  {result.success ? `${result.efficiency}% efficient` : 'Failed'}
                </Badge>
              </div>

              {result.success ? (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">
                    Assigned to: {result.assignedTables.map(tableId => {
                      const table = tables.find(t => t.id === tableId);
                      return table ? `Table ${table.table_number}` : 'Unknown';
                    }).join(', ')}
                  </p>
                </div>
              ) : (
                <div className="text-sm">
                  <p className="text-red-600 mb-1">Assignment failed</p>
                </div>
              )}

              {result.conflicts.length > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                  <p className="font-medium text-yellow-800 mb-1">Issues:</p>
                  <ul className="text-yellow-700 space-y-1">
                    {result.conflicts.map((conflict, i) => (
                      <li key={i}>• {conflict}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};