import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, SeatPosition, TableArrangement, ConnectionPoint } from '@/types/table';
import { 
  Users, Target, TrendingUp, AlertTriangle, CheckCircle, 
  Clock, Zap, Link, Unlink 
} from 'lucide-react';

interface EnhancedVisualFeedbackProps {
  tables: Table[];
  arrangements: TableArrangement[];
  seatPositions: Record<string, SeatPosition[]>;
  connectionPoints: ConnectionPoint[];
  isRealTimeMode?: boolean;
}

interface CapacityMetrics {
  totalSeats: number;
  availableSeats: number;
  lostSeats: number;
  spareSeats: number;
  efficiency: number;
  connectionCount: number;
  accessibility: {
    accessibleSeats: number;
    percentage: number;
  };
}

interface RecommendationItem {
  type: 'warning' | 'suggestion' | 'success';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export const EnhancedVisualFeedback = ({
  tables,
  arrangements,
  seatPositions,
  connectionPoints,
  isRealTimeMode = true
}: EnhancedVisualFeedbackProps) => {
  const [metrics, setMetrics] = useState<CapacityMetrics>({
    totalSeats: 0,
    availableSeats: 0,
    lostSeats: 0,
    spareSeats: 0,
    efficiency: 100,
    connectionCount: 0,
    accessibility: { accessibleSeats: 0, percentage: 0 }
  });

  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Real-time metrics calculation
  useEffect(() => {
    if (isRealTimeMode) {
      setIsUpdating(true);
      const timer = setTimeout(() => {
        calculateMetrics();
        generateRecommendations();
        setIsUpdating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [arrangements, seatPositions, connectionPoints, isRealTimeMode]);

  const calculateMetrics = () => {
    let totalSeats = 0;
    let availableSeats = 0;
    let lostSeats = 0;
    let spareSeats = 0;
    let accessibleSeats = 0;

    Object.values(seatPositions).forEach(seats => {
      seats.forEach(seat => {
        totalSeats++;
        if (seat.seat_status === 'available') {
          availableSeats++;
          if (seat.is_accessible) accessibleSeats++;
        } else if (seat.seat_status === 'lost') {
          lostSeats++;
        } else if (seat.seat_status === 'spare') {
          spareSeats++;
        }
      });
    });

    const efficiency = totalSeats > 0 ? (availableSeats / totalSeats) * 100 : 100;
    const accessibilityPercentage = availableSeats > 0 ? (accessibleSeats / availableSeats) * 100 : 0;

    setMetrics({
      totalSeats,
      availableSeats,
      lostSeats,
      spareSeats,
      efficiency: Math.round(efficiency),
      connectionCount: connectionPoints.length / 2, // Each connection has 2 points
      accessibility: {
        accessibleSeats,
        percentage: Math.round(accessibilityPercentage)
      }
    });
  };

  const generateRecommendations = () => {
    const newRecommendations: RecommendationItem[] = [];

    // Efficiency recommendations
    if (metrics.efficiency < 70) {
      newRecommendations.push({
        type: 'warning',
        title: 'Low Seating Efficiency',
        description: `Only ${metrics.efficiency}% of seats are available. Consider reducing seat loss or optimizing table connections.`,
        priority: 'high'
      });
    } else if (metrics.efficiency >= 90) {
      newRecommendations.push({
        type: 'success',
        title: 'Excellent Efficiency',
        description: `${metrics.efficiency}% efficiency achieved. Your layout is well optimized.`,
        priority: 'low'
      });
    }

    // Accessibility recommendations
    if (metrics.accessibility.percentage < 10 && metrics.availableSeats > 4) {
      newRecommendations.push({
        type: 'suggestion',
        title: 'Improve Accessibility',
        description: 'Consider adding more accessible seats to meet accessibility standards (10% minimum recommended).',
        priority: 'medium'
      });
    }

    // Connection recommendations
    if (connectionPoints.length > 0 && metrics.lostSeats === 0) {
      newRecommendations.push({
        type: 'suggestion',
        title: 'Verify Table Connections',
        description: 'Table connections are defined but no seat loss detected. Verify connection points are accurate.',
        priority: 'medium'
      });
    }

    // Spare seat recommendations
    if (metrics.spareSeats > metrics.availableSeats * 0.15) {
      newRecommendations.push({
        type: 'warning',
        title: 'High Spare Seat Count',
        description: 'Consider redistributing spare seats or removing excess capacity.',
        priority: 'medium'
      });
    }

    setRecommendations(newRecommendations);
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 85) return 'text-green-600';
    if (efficiency >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRecommendationIcon = (type: RecommendationItem['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'suggestion': return <Target className="h-4 w-4 text-blue-600" />;
    }
  };

  const getPriorityBadgeVariant = (priority: RecommendationItem['priority']) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Real-time Metrics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Real-time Capacity Analysis
              {isUpdating && (
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse ml-2" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{metrics.availableSeats}</p>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Available seats ready for guests</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <Target className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className={`text-2xl font-bold ${getEfficiencyColor(metrics.efficiency)}`}>
                      {metrics.efficiency}%
                    </p>
                    <p className="text-xs text-muted-foreground">Efficiency</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Percentage of total seats that are available</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <Link className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{metrics.connectionCount}</p>
                    <p className="text-xs text-muted-foreground">Connections</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Number of table connections defined</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <Zap className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-2xl font-bold">{metrics.accessibility.accessibleSeats}</p>
                    <p className="text-xs text-muted-foreground">Accessible</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{metrics.accessibility.percentage}% of available seats are accessible</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Efficiency Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Efficiency</span>
                <span className={getEfficiencyColor(metrics.efficiency)}>
                  {metrics.efficiency}%
                </span>
              </div>
              <Progress value={metrics.efficiency} className="h-2" />
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Seats:</span>
                  <span>{metrics.totalSeats}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available:</span>
                  <span className="text-green-600">{metrics.availableSeats}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lost:</span>
                  <span className="text-red-600">{metrics.lostSeats}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spare:</span>
                  <span className="text-yellow-600">{metrics.spareSeats}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Smart Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 border rounded-lg bg-muted/20"
                  >
                    {getRecommendationIcon(rec.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{rec.title}</h4>
                        <Badge 
                          variant={getPriorityBadgeVariant(rec.priority)}
                          className="text-xs"
                        >
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
};