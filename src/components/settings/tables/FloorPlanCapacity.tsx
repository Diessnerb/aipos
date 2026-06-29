import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Users, 
  Table, 
  Coffee, 
  Armchair, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  MapPin,
  Accessibility
} from 'lucide-react';
import { FloorPlanObject } from '@/types/floorplan';

interface FloorPlanCapacityProps {
  objects: FloorPlanObject[];
  canvasWidth: number;
  canvasHeight: number;
}

interface CapacityAnalysis {
  totalSeats: number;
  tableSeats: number;
  boothSeats: number;
  barSeats: number;
  highTableSeats: number;
  waitingCapacity: number;
  accessibility: {
    accessibleTables: number;
    accessibilityPaths: number;
    emergencyExits: number;
  };
  efficiency: {
    spaceUtilization: number;
    trafficFlowScore: number;
    serviceEfficiency: number;
  };
  compliance: {
    fireCode: boolean;
    accessibility: boolean;
    healthDepartment: boolean;
  };
}

export const FloorPlanCapacity = ({ 
  objects, 
  canvasWidth, 
  canvasHeight 
}: FloorPlanCapacityProps) => {
  
  const analysis = useMemo((): CapacityAnalysis => {
    const tables = objects.filter(obj => obj.object_type === 'table');
    const booths = objects.filter(obj => obj.object_type === 'booth');
    const barStools = objects.filter(obj => obj.object_type === 'bar-stool');
    const highTables = objects.filter(obj => obj.object_type === 'high-table');
    const waitingBenches = objects.filter(obj => obj.object_type === 'waiting-bench');
    const accessibilityPaths = objects.filter(obj => obj.object_type === 'accessibility-path');
    const emergencyExits = objects.filter(obj => obj.object_type === 'emergency-exit');
    const serviceStations = objects.filter(obj => obj.object_type === 'service-station');

    // Calculate seating capacity
    const tableSeats = tables.reduce((sum, table) => sum + (table.seats || 4), 0);
    const boothSeats = booths.reduce((sum, booth) => sum + (booth.booth_seats || 6), 0);
    const barSeats = barStools.length; // Each stool = 1 seat
    const highTableSeats = highTables.reduce((sum, table) => sum + (table.high_table_seats || 2), 0);
    const waitingCapacity = waitingBenches.reduce((sum, bench) => sum + (bench.bench_capacity || 4), 0);

    // Calculate accessible tables (assuming 10% should be accessible)
    const accessibleTables = tables.filter(table => table.accessibility_friendly).length;

    // Calculate space utilization
    const totalArea = canvasWidth * canvasHeight;
    const occupiedArea = objects.length * 2000; // Rough estimate
    const spaceUtilization = Math.min((occupiedArea / totalArea) * 100, 100);

    // Calculate traffic flow score (based on paths and spacing)
    const trafficFlowScore = Math.min(
      (accessibilityPaths.length * 20) + 
      (emergencyExits.length * 15) + 
      (serviceStations.length * 10), 
      100
    );

    // Calculate service efficiency
    const tablesPerServiceStation = tables.length / Math.max(serviceStations.length, 1);
    const serviceEfficiency = Math.max(100 - (tablesPerServiceStation * 5), 0);

    // Compliance checks
    const totalSeats = tableSeats + boothSeats + barSeats + highTableSeats;
    const fireCode = emergencyExits.length >= Math.ceil(totalSeats / 50); // 1 exit per 50 people
    const accessibilityCompliant = accessibleTables >= Math.ceil(tables.length * 0.1); // 10% accessible
    const healthDepartmentCompliant = serviceStations.length >= Math.ceil(tables.length / 15); // 1 station per 15 tables

    return {
      totalSeats,
      tableSeats,
      boothSeats,
      barSeats,
      highTableSeats,
      waitingCapacity,
      accessibility: {
        accessibleTables,
        accessibilityPaths: accessibilityPaths.length,
        emergencyExits: emergencyExits.length,
      },
      efficiency: {
        spaceUtilization: Math.round(spaceUtilization),
        trafficFlowScore: Math.round(trafficFlowScore),
        serviceEfficiency: Math.round(serviceEfficiency),
      },
      compliance: {
        fireCode,
        accessibility: accessibilityCompliant,
        healthDepartment: healthDepartmentCompliant,
      },
    };
  }, [objects, canvasWidth, canvasHeight]);

  const getComplianceColor = (compliant: boolean) => 
    compliant ? 'text-green-600' : 'text-red-600';

  const getEfficiencyColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="w-80 bg-background border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Capacity Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seating Capacity */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Seating Capacity
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-2 bg-muted/20 rounded">
              <div className="text-2xl font-bold text-primary">{analysis.totalSeats}</div>
              <div className="text-xs text-muted-foreground">Total Seats</div>
            </div>
            <div className="text-center p-2 bg-muted/20 rounded">
              <div className="text-2xl font-bold text-secondary">{analysis.waitingCapacity}</div>
              <div className="text-xs text-muted-foreground">Waiting</div>
            </div>
          </div>
          
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                <Table className="h-3 w-3" />
                Tables:
              </span>
              <Badge variant="outline">{analysis.tableSeats}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                <Armchair className="h-3 w-3" />
                Booths:
              </span>
              <Badge variant="outline">{analysis.boothSeats}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1">
                <Coffee className="h-3 w-3" />
                Bar:
              </span>
              <Badge variant="outline">{analysis.barSeats}</Badge>
            </div>
            <div className="flex justify-between">
              <span>High Tables:</span>
              <Badge variant="outline">{analysis.highTableSeats}</Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Efficiency Metrics */}
        <div className="space-y-3">
          <h4 className="font-medium">Efficiency Metrics</h4>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Space Utilization</span>
              <span className={`text-sm font-medium ${getEfficiencyColor(analysis.efficiency.spaceUtilization)}`}>
                {analysis.efficiency.spaceUtilization}%
              </span>
            </div>
            <Progress value={analysis.efficiency.spaceUtilization} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Traffic Flow</span>
              <span className={`text-sm font-medium ${getEfficiencyColor(analysis.efficiency.trafficFlowScore)}`}>
                {analysis.efficiency.trafficFlowScore}%
              </span>
            </div>
            <Progress value={analysis.efficiency.trafficFlowScore} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Service Efficiency</span>
              <span className={`text-sm font-medium ${getEfficiencyColor(analysis.efficiency.serviceEfficiency)}`}>
                {analysis.efficiency.serviceEfficiency}%
              </span>
            </div>
            <Progress value={analysis.efficiency.serviceEfficiency} className="h-2" />
          </div>
        </div>

        <Separator />

        {/* Accessibility */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Accessibility className="h-4 w-4" />
            Accessibility
          </h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Accessible Tables:</span>
              <Badge variant="outline">{analysis.accessibility.accessibleTables}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Access Paths:</span>
              <Badge variant="outline">{analysis.accessibility.accessibilityPaths}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Emergency Exits:</span>
              <Badge variant="outline">{analysis.accessibility.emergencyExits}</Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Compliance Status */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Compliance
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Fire Code</span>
              <div className="flex items-center gap-1">
                {analysis.compliance.fireCode ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-sm ${getComplianceColor(analysis.compliance.fireCode)}`}>
                  {analysis.compliance.fireCode ? 'Pass' : 'Fail'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Accessibility</span>
              <div className="flex items-center gap-1">
                {analysis.compliance.accessibility ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-sm ${getComplianceColor(analysis.compliance.accessibility)}`}>
                  {analysis.compliance.accessibility ? 'Pass' : 'Fail'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Service Standards</span>
              <div className="flex items-center gap-1">
                {analysis.compliance.healthDepartment ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-sm ${getComplianceColor(analysis.compliance.healthDepartment)}`}>
                  {analysis.compliance.healthDepartment ? 'Pass' : 'Fail'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {(!analysis.compliance.fireCode || !analysis.compliance.accessibility || !analysis.compliance.healthDepartment) && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium text-orange-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Recommendations
              </h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                {!analysis.compliance.fireCode && (
                  <div>• Add more emergency exits (need {Math.ceil(analysis.totalSeats / 50) - analysis.accessibility.emergencyExits} more)</div>
                )}
                {!analysis.compliance.accessibility && (
                  <div>• Make more tables accessible (need {Math.ceil(objects.filter(o => o.object_type === 'table').length * 0.1) - analysis.accessibility.accessibleTables} more)</div>
                )}
                {!analysis.compliance.healthDepartment && (
                  <div>• Add service stations (recommended: 1 per 15 tables)</div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};