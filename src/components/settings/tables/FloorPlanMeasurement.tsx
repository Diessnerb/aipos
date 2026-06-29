import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ruler, X, Calculator, Grid3X3 } from 'lucide-react';

interface Measurement {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  distance: number;
  angle: number;
}

interface FloorPlanMeasurementProps {
  isActive: boolean;
  onClose: () => void;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

export const FloorPlanMeasurement = ({ 
  isActive, 
  onClose, 
  canvasRef 
}: FloorPlanMeasurementProps) => {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentMeasurement, setCurrentMeasurement] = useState<Partial<Measurement> | null>(null);
  const [totalDistance, setTotalDistance] = useState(0);

  useEffect(() => {
    if (!isActive || !canvasRef?.current) return;

    const canvas = canvasRef.current;
    
    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setIsDrawing(true);
      setCurrentMeasurement({
        id: Date.now().toString(),
        startX: x,
        startY: y,
        endX: x,
        endY: y,
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawing || !currentMeasurement) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const distance = Math.sqrt(
        Math.pow(x - (currentMeasurement.startX || 0), 2) + 
        Math.pow(y - (currentMeasurement.startY || 0), 2)
      );
      
      const angle = Math.atan2(
        y - (currentMeasurement.startY || 0),
        x - (currentMeasurement.startX || 0)
      ) * (180 / Math.PI);

      setCurrentMeasurement(prev => prev ? {
        ...prev,
        endX: x,
        endY: y,
        distance: Math.round(distance * 10) / 10, // Round to 1 decimal
        angle: Math.round(angle * 10) / 10,
      } : null);
    };

    const handleMouseUp = () => {
      if (currentMeasurement && currentMeasurement.distance && currentMeasurement.distance > 5) {
        const newMeasurement: Measurement = {
          id: currentMeasurement.id!,
          startX: currentMeasurement.startX!,
          startY: currentMeasurement.startY!,
          endX: currentMeasurement.endX!,
          endY: currentMeasurement.endY!,
          distance: currentMeasurement.distance,
          angle: currentMeasurement.angle!,
        };
        
        setMeasurements(prev => [...prev, newMeasurement]);
        setTotalDistance(prev => prev + newMeasurement.distance);
      }
      
      setIsDrawing(false);
      setCurrentMeasurement(null);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isActive, canvasRef, isDrawing, currentMeasurement]);

  const clearMeasurements = () => {
    setMeasurements([]);
    setTotalDistance(0);
  };

  const removeMeasurement = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (measurement) {
      setMeasurements(prev => prev.filter(m => m.id !== id));
      setTotalDistance(prev => prev - measurement.distance);
    }
  };

  const convertToFeet = (pixels: number): number => {
    // Assuming 20 pixels = 1 foot (adjustable based on scale)
    return Math.round((pixels / 20) * 10) / 10;
  };

  const convertToMeters = (pixels: number): number => {
    // Assuming 20 pixels = 0.3048 meters (1 foot)
    return Math.round((pixels / 20) * 0.3048 * 100) / 100;
  };

  if (!isActive) return null;

  return (
    <div className="fixed top-20 right-4 z-40">
      <Card className="w-80 bg-background border border-border shadow-lg">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-primary" />
              <span className="font-medium">Measurement Tool</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground bg-muted/20 p-2 rounded">
            Click and drag to measure distances. Measurements will appear below.
          </div>

          {/* Current Measurement */}
          {currentMeasurement && currentMeasurement.distance && (
            <div className="p-2 bg-primary/10 rounded border border-primary/20">
              <div className="text-sm font-medium text-primary">
                Current: {currentMeasurement.distance}px 
                ({convertToFeet(currentMeasurement.distance)}ft / {convertToMeters(currentMeasurement.distance)}m)
              </div>
              <div className="text-xs text-muted-foreground">
                Angle: {currentMeasurement.angle}°
              </div>
            </div>
          )}

          {/* Measurements List */}
          {measurements.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Measurements</span>
                <Button variant="outline" size="sm" onClick={clearMeasurements}>
                  Clear All
                </Button>
              </div>
              
              {measurements.map((measurement, index) => (
                <div 
                  key={measurement.id} 
                  className="flex items-center justify-between p-2 bg-muted/20 rounded text-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      #{index + 1}: {measurement.distance}px
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {convertToFeet(measurement.distance)}ft / {convertToMeters(measurement.distance)}m
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMeasurement(measurement.id)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {measurements.length > 0 && (
            <div className="pt-2 border-t border-border space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total Distance:</span>
                <Badge variant="secondary">
                  {Math.round(totalDistance * 10) / 10}px
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Feet: {convertToFeet(totalDistance)}ft</div>
                <div>Meters: {convertToMeters(totalDistance)}m</div>
              </div>
              <div className="text-xs text-muted-foreground">
                Count: {measurements.length} measurement{measurements.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          {/* Scale Reference */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Grid3X3 className="h-3 w-3" />
              <span>Scale: 20px = 1ft (0.3m)</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              <Calculator className="h-3 w-3 mr-1" />
              Calculate Area
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};