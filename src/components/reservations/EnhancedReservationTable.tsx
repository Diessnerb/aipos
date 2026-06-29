import React, { useState, useMemo } from 'react';
import { formatCustomerName } from '@/utils/nameUtils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ChevronUp, ChevronDown, AlertTriangle, Phone, Mail, RefreshCw } from 'lucide-react';
import { Reservation } from '@/types/reservation';
import { ReservationStatusPill } from './ReservationStatusPill';
import { AutoAssignmentIndicator } from './AutoAssignmentIndicator';
import { ManualAssignmentModal } from './ManualAssignmentModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EnhancedReservationTableProps {
  reservations: Reservation[];
  onEdit: (reservation: Reservation) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Reservation['status']) => void;
  isReservationInPast: (date: string) => boolean;
  shouldShowPastDateAlert: (reservation: Reservation) => boolean;
  getTableDisplay: (reservation: Reservation) => string;
  onManualAssign?: (reservation: Reservation, tableNumber: number) => void;
  onReservationUpdate?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

type SortField = 'date' | 'party_size' | 'status' | 'customer_name';
type SortDirection = 'asc' | 'desc';

// Column configuration for consistent header/body alignment
const COLUMN_CONFIG = [
  { key: 'customer', label: 'Guest', width: 'w-48 min-w-[12rem]', sortField: 'customer_name' as SortField },
  { key: 'date', label: 'Date', width: 'w-28 min-w-[7rem]', sortField: 'date' as SortField },
  { key: 'time', label: 'Time', width: 'w-24 min-w-[6rem]', sortField: null },
  { key: 'table', label: 'Table', width: 'w-32 min-w-[8rem]', sortField: null },
  { key: 'party_size', label: 'Party', width: 'w-16 min-w-[4rem]', sortField: 'party_size' as SortField },
  { key: 'contact', label: 'Contact', width: 'w-40 min-w-[10rem]', sortField: null, responsive: 'hidden md:table-cell' },
  { key: 'status', label: 'Status', width: 'w-28 min-w-[7rem]', sortField: 'status' as SortField },
  { key: 'assignment', label: 'Assignment', width: 'w-44 min-w-[11rem]', sortField: null, responsive: 'hidden lg:table-cell' },
  { key: 'actions', label: 'Actions', width: 'w-40 min-w-[10rem]', sortField: null }
];

export const EnhancedReservationTable: React.FC<EnhancedReservationTableProps> = React.memo(({
  reservations,
  onEdit,
  onDelete,
  onStatusChange,
  isReservationInPast,
  shouldShowPastDateAlert,
  getTableDisplay,
  onManualAssign,
  onReservationUpdate,
  emptyTitle = "No reservations found",
  emptyDescription = "Try adjusting your filters or create a new reservation",
}) => {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [manualAssignReservation, setManualAssignReservation] = useState<Reservation | null>(null);
  const [reEvaluatingIds, setReEvaluatingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedReservations = useMemo(() => {
    return [...reservations].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'date':
          aValue = new Date(`${a.date} ${a.time}`).getTime();
          bValue = new Date(`${b.date} ${b.time}`).getTime();
          break;
        case 'party_size':
          aValue = a.party_size;
          bValue = b.party_size;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'customer_name':
          aValue = a.customer_name.toLowerCase();
          bValue = b.customer_name.toLowerCase();
          break;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [reservations, sortField, sortDirection]);

  const formatDate = (date: string) => {
    try {
      const dateObj = new Date(date);
      return format(dateObj, 'EEE dd MMM');
    } catch {
      return date;
    }
  };

  const formatTime = (time: string) => {
    return time;
  };

  const handleReEvaluateAssignment = async (reservation: Reservation) => {
    if (reEvaluatingIds.has(reservation.id)) return;
    
    setReEvaluatingIds(prev => new Set(prev).add(reservation.id));
    
    try {
      // Get company ID from user context since it's not on the reservation type
      const { data: user } = await supabase.from('users').select('company_id').eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id).single();
      
      if (!user?.company_id) {
        throw new Error('Unable to determine company ID');
      }

      // Step 1: Clear current assignment and prepare for re-evaluation
      const { data: clearResult, error: clearError } = await supabase
        .rpc('re_evaluate_full_assignment', {
          p_reservation_id: reservation.id,
          p_company_id: user.company_id
        });

      if (clearError || !(clearResult as any)?.success) {
        console.error('Assignment clearing failed:', clearError);
        toast({
          title: "Re-evaluation Failed",
          description: (clearResult as any)?.message || 'Failed to prepare reservation for re-evaluation',
          variant: "destructive"
        });
        return;
      }

      const result = clearResult as any;
      const oldAssignment = result.old_assignment;
      const reservationDetails = result.reservation_details;

      // Step 2: Run full ReservationAssignmentService logic
      const { ReservationAssignmentService } = await import('../../services/reservationAssignmentService');
      
      const assignmentResult = await ReservationAssignmentService.reEvaluateAssignment(
        reservation.id,
        user.company_id
      );

      if (assignmentResult.success && assignmentResult.assignedTables?.length > 0) {
        toast({
          title: "✨ Assignment Improved!",
          description: assignmentResult.message,
        });
      } else {
        toast({
          title: "No Better Assignment Available",
          description: assignmentResult.message,
          variant: "destructive"
        });
      }

      // Trigger refresh
      if (onReservationUpdate) {
        onReservationUpdate();
      }

    } catch (error) {
      console.error('Re-evaluation failed:', error);
      toast({
        title: "Re-evaluation Failed",
        description: error instanceof Error ? error.message : 'Failed to re-evaluate table assignment',
        variant: "destructive"
      });
    } finally {
      setReEvaluatingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(reservation.id);
        return newSet;
      });
    }
  };

  const SortButton = ({ field, children }: { field: SortField | null; children: React.ReactNode }) => {
    if (!field) return <span>{children}</span>;
    
    return (
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? 
          <ChevronUp className="h-3 w-3" /> : 
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
    );
  };

  if (reservations.length === 0) {
    return (
      <div className="bg-card rounded-lg border">
        <div className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">{emptyTitle}</h3>
          <p className="text-sm text-muted-foreground">{emptyDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border">
      <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {COLUMN_CONFIG.map((column) => (
                <TableHead 
                  key={column.key}
                  className={`${column.width} ${column.responsive || ''}`}
                >
                  <SortButton field={column.sortField}>
                    {column.label}
                  </SortButton>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedReservations.map((reservation, index) => (
              <TableRow 
                key={reservation.id}
                className={`hover:bg-muted/50 transition-colors ${
                  index % 2 === 1 ? 'bg-muted/20' : ''
                }`}
              >
                {/* Guest */}
                <TableCell className={COLUMN_CONFIG[0].width}>
                  <div>
                    <div className="font-semibold text-sm">
                      {formatCustomerName(reservation.customer_name)}
                    </div>
                    {shouldShowPastDateAlert(reservation) && (
                      <AlertTriangle className="h-3 w-3 text-amber-500 mt-1" />
                    )}
                  </div>
                </TableCell>
                
                {/* Date */}
                <TableCell className={COLUMN_CONFIG[1].width}>
                  <span className="text-sm">{formatDate(reservation.date)}</span>
                </TableCell>
                
                {/* Time */}
                <TableCell className={COLUMN_CONFIG[2].width}>
                  <span className="text-sm font-mono">{formatTime(reservation.time)}</span>
                </TableCell>
                
                {/* Table */}
                <TableCell className={COLUMN_CONFIG[3].width}>
                  <span className="text-sm font-medium">{getTableDisplay(reservation)}</span>
                </TableCell>
                
                {/* Party Size */}
                <TableCell className={COLUMN_CONFIG[4].width}>
                  <span className="text-sm font-medium">{reservation.party_size}</span>
                </TableCell>
                
                {/* Contact */}
                <TableCell className={`${COLUMN_CONFIG[5].width} ${COLUMN_CONFIG[5].responsive}`}>
                  <div className="space-y-1">
                    {reservation.phone && (
                      <div className="flex items-center gap-1 text-xs">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{reservation.phone}</span>
                      </div>
                    )}
                    {reservation.email && (
                      <div className="flex items-center gap-1 text-xs">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="max-w-[8rem] truncate" title={reservation.email}>
                          {reservation.email}
                        </span>
                      </div>
                    )}
                  </div>
                </TableCell>
                
                {/* Status */}
                <TableCell className={COLUMN_CONFIG[6].width}>
                  <ReservationStatusPill 
                    status={reservation.status} 
                    onStatusChange={onStatusChange ? (newStatus) => onStatusChange(reservation.id, newStatus) : undefined}
                  />
                </TableCell>
                
                {/* Assignment */}
                <TableCell className={`${COLUMN_CONFIG[7].width} ${COLUMN_CONFIG[7].responsive}`}>
                  <AutoAssignmentIndicator
                    reservation={reservation}
                    onManualAssign={() => setManualAssignReservation(reservation)}
                  />
                </TableCell>
                
                {/* Actions */}
                <TableCell className={COLUMN_CONFIG[8].width}>
                  <div className="flex items-center gap-1 flex-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit?.(reservation)}
                      className="h-8 px-2 text-xs"
                    >
                      Edit
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30"
                        >
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Reservation</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete the reservation for {formatCustomerName(reservation.customer_name)} on {formatDate(reservation.date)} at {formatTime(reservation.time)}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDelete?.(reservation.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {/* Re-evaluate Assignment Button - show for all assigned reservations */}
                    {(reservation.table_number || reservation.table_numbers?.length) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReEvaluateAssignment(reservation)}
                        disabled={reEvaluatingIds.has(reservation.id)}
                        className="h-8 px-2 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                        title="Reset and re-evaluate table assignment using complete assignment logic"
                      >
                        {reEvaluatingIds.has(reservation.id) ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      
      <ManualAssignmentModal
        open={!!manualAssignReservation}
        onOpenChange={(open) => !open && setManualAssignReservation(null)}
        reservation={manualAssignReservation}
        existingReservations={reservations}
        onAssign={(tableNumber) => {
          if (manualAssignReservation && onManualAssign) {
            onManualAssign(manualAssignReservation, tableNumber);
          }
        }}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Shallow comparison of reservations array
  return prevProps.reservations.length === nextProps.reservations.length &&
    prevProps.reservations.every((res, index) => res.id === nextProps.reservations[index]?.id);
});