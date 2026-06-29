import { AlertTriangle, Clock, Users, Phone, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { DoubleBookingAlert } from '@/services/reservationConflictService';

interface ConflictAlertBannerProps {
  conflicts: DoubleBookingAlert[];
  onDismiss?: () => void;
  className?: string;
}

export const ConflictAlertBanner = ({ 
  conflicts, 
  onDismiss,
  className = "" 
}: ConflictAlertBannerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (conflicts.length === 0) return null;

  const totalAffectedReservations = conflicts.reduce(
    (sum, conflict) => sum + conflict.reservation_count, 
    0
  );

  return (
    <Alert className={`border-red-500 bg-red-50 dark:bg-red-950 ${className}`}>
      <AlertTriangle className="h-4 w-4 text-red-600" />
      <div className="flex items-center justify-between w-full">
        <div className="flex-1">
          <AlertDescription className="text-red-800 dark:text-red-200">
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                ⚠️ Double Booking Alert: {conflicts.length} table conflict{conflicts.length > 1 ? 's' : ''} detected
              </span>
              <Badge variant="destructive" className="text-xs">
                {totalAffectedReservations} reservations affected
              </Badge>
            </div>
            
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-red-700 dark:text-red-300 hover:text-red-900"
                >
                  {isExpanded ? 'Hide details' : 'Show details'}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-3 space-y-3">
                {conflicts.map((conflict, index) => (
                  <Card key={index} className="border-red-200 bg-white dark:bg-red-900/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        Table {conflict.table_number} - {conflict.conflict_time} on{' '}
                        {new Date(conflict.conflict_date).toLocaleDateString()}
                        <Badge variant="outline" className="ml-auto">
                          {conflict.reservation_count} bookings
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {conflict.reservation_details.map((reservation) => (
                          <div 
                            key={reservation.id}
                            className="flex items-center justify-between p-2 bg-red-100 dark:bg-red-800/30 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <Users className="h-3 w-3" />
                              <span className="font-medium">{reservation.customer_name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {reservation.party_size} guests
                              </Badge>
                              <Badge 
                                variant={reservation.status === 'confirmed' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {reservation.status}
                              </Badge>
                            </div>
                            {reservation.phone && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {reservation.phone}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-800 dark:text-yellow-200">
                        <strong>Action Required:</strong> Contact these customers immediately to resolve the double booking.
                        Suggest alternative times or tables to prevent conflicts.
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </AlertDescription>
        </div>
        
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-red-600 hover:text-red-800 hover:bg-red-100"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Alert>
  );
};