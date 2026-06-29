import React, { useState, useEffect, useRef } from 'react';
import { formatCustomerName } from '@/utils/nameUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,  
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lock, Unlock, CalendarIcon, Clock, Plus, Minus, Users, MapPin, Accessibility, AlertCircle, Wand2, Printer, Phone, Mail, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTablesQuery } from '@/hooks/useTablesQuery';
import { useTableGroups } from '@/hooks/useTableGroups';
import { useAuth } from '@/components/AuthProvider';
import { Table } from '@/types/table';
import { Reservation } from '@/types/reservation';
import { DatePickerModal } from './DatePickerModal';
import { TimeSelectionModal } from './TimeSelectionModal';
import { ConflictValidationModal } from './ConflictValidationModal';
import { ReservationConflictService, ConflictValidationResult } from '@/services/reservationConflictService';
import { format } from 'date-fns';
import { normalizeUKPhone, validateUKPhone, formatPhoneForDisplay, getPhoneValidationError } from '@/utils/phoneUtils';
import { getNextFifteenMinuteSlot } from '@/utils/timeUtils';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ALLERGEN_LIST } from '@/utils/allergens';
import { TableMoveFeedbackModal } from './TableMoveFeedbackModal';
import { CheckBackFeedbackModal } from './CheckBackFeedbackModal';
import { TableAssignmentOrchestrator } from '@/services/tableAssignmentOrchestrator';
import { getAllergenWarningText } from '@/utils/allergens';
import { detectAccessibilityNeeds } from '@/utils/accessibilityDetection';
import { Loader2, AlertTriangle, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { isValidTableCombination } from '@/utils/tableGroupUtils';
import { getDeviceInfo } from '@/utils/deviceDetection';
import { isReservationInPast, isReservationStartTimePast } from '@/utils/reservationUtils';
import { validateReservationTime, getDayOfWeekFromDate } from '@/utils/foodServiceValidation';
import { useCompanyLocation } from '@/hooks/useCompanyLocation';
import { getCourseDuration, getEatingStatusForCourse, getNextCourseStatus, getServedAtFieldForCourse } from '@/utils/courseDurationHelpers';
import { offlineAwareUpdate } from '@/utils/offlineAwareSupabase';

import { CustomerForm, CustomerFormProps } from '@/pages/CustomerCRM';
import { Customer } from '@/hooks/useCompanyFilteredCustomers';

/**
 * Helper function to update customer's late arrival count
 */
async function updateCustomerLateCount(companyId: string, phone: string, minutesLate: number) {
  try {
    const normalizedPhone = normalizeUKPhone(phone);
    if (!normalizedPhone) {
      console.warn('Invalid phone number for late count update:', phone);
      return;
    }

    // Find the customer
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('id, late_count, average_minutes_late')
      .eq('company_id', companyId)
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching customer for late count:', fetchError);
      return;
    }

    if (!customer) {
      console.warn('Customer not found for late count update:', normalizedPhone);
      return;
    }

    // Calculate new average lateness
    const oldCount = customer.late_count || 0;
    const oldAverage = customer.average_minutes_late || 0;
    const newCount = oldCount + 1;
    const newAverage = Math.round(((oldAverage * oldCount) + minutesLate) / newCount);

    // Update customer record
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        late_count: newCount,
        average_minutes_late: newAverage,
      })
      .eq('id', customer.id);

    if (updateError) {
      console.error('Error updating customer late count:', updateError);
    } else {
      console.log(`✅ Updated customer late count: ${newCount}, avg: ${newAverage} mins`);
    }
  } catch (error) {
    console.error('Failed to update customer late count:', error);
  }
}

/**
 * Helper function to update customer's no-show count
 */
async function updateCustomerNoShowCount(companyId: string, phone: string) {
  try {
    const normalizedPhone = normalizeUKPhone(phone);
    if (!normalizedPhone) {
      console.warn('Invalid phone number for no-show count update:', phone);
      return;
    }

    // Find the customer
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('id, no_show_count')
      .eq('company_id', companyId)
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching customer for no-show count:', fetchError);
      return;
    }

    if (!customer) {
      console.warn('Customer not found for no-show count update:', normalizedPhone);
      return;
    }

    // Increment no-show count
    const newCount = (customer.no_show_count || 0) + 1;

    const { error: updateError } = await supabase
      .from('customers')
      .update({
        no_show_count: newCount,
      })
      .eq('id', customer.id);

    if (updateError) {
      console.error('Error updating customer no-show count:', updateError);
    } else {
      console.log(`✅ Updated customer no-show count: ${newCount}`);
    }
  } catch (error) {
    console.error('Failed to update customer no-show count:', error);
  }
}

interface EditReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reservation: Reservation) => void;
  reservation: Reservation | null | undefined;
}

export const EditReservationModal: React.FC<EditReservationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  reservation,
}) => {
  const { tables: allTables } = useTablesQuery();
  const { tableGroups, fetchTableGroups } = useTableGroups();
  
  // Filter operational tables - exclude temporarily_removed but keep out_of_service for display as disabled
  const operationalTables = allTables.filter(t => 
    t.is_active && 
    (t.service_status !== 'temporarily_removed')
  );
  const { companyId } = useAuth();
  const { location } = useCompanyLocation();
  const [selectedTables, setSelectedTables] = useState<number[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [formData, setFormData] = useState({
    customer_name: '',
    party_size: 2,
    phone: '',
    email: '',
    date: '',
    time: '',
    status: 'confirmed' as Reservation['status'],
    notes: '',
    has_allergens: false,
    allergens: [] as string[]
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [conflictResult, setConflictResult] = useState<ConflictValidationResult | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [originalTableNumbers, setOriginalTableNumbers] = useState<number[] | null>(null);
  const [newTableNumbers, setNewTableNumbers] = useState<number[]>([]);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [canAutoAssign, setCanAutoAssign] = useState(false);
  const [isAutoResolving, setIsAutoResolving] = useState(false);
  const [checkBackFeedbackModal, setCheckBackFeedbackModal] = useState<{
    isOpen: boolean;
    course: 'starters' | 'mains' | 'desserts' | null;
  }>({
    isOpen: false,
    course: null,
  });
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);

  // Update form when reservation changes
  useEffect(() => {
    if (reservation && isOpen) {
      setFormData({
        customer_name: reservation.customer_name,
        party_size: reservation.party_size,
        phone: reservation.phone || '',
        email: reservation.email || '',
        date: reservation.date,
        time: reservation.time,
        status: reservation.status,
        notes: reservation.notes || '',
        has_allergens: reservation.has_allergens || false,
        allergens: reservation.allergens || []
      });

      // Set locked state - prioritize is_locked, fallback to locked
      setIsLocked(reservation.is_locked ?? reservation.locked ?? false);

      // Set selected tables based on reservation data
      if (reservation.table_numbers && reservation.table_numbers.length > 0) {
        const tables = reservation.table_numbers;
        setSelectedTables(tables);
        setOriginalTableNumbers(tables);
      } else if (reservation.table_number) {
        const tables = [reservation.table_number];
        setSelectedTables(tables);
        setOriginalTableNumbers(tables);
      } else {
        setSelectedTables([]);
        setOriginalTableNumbers(null);
      }
    }
  }, [reservation, isOpen]);

  // Fetch table groups when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTableGroups();
    }
  }, [isOpen, fetchTableGroups]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        customer_name: '',
        party_size: 2,
        phone: '',
        email: '',
        date: '',
        time: '',
        status: 'confirmed',
        notes: '',
        has_allergens: false,
        allergens: []
      });
      setSelectedTables([]);
      setIsLocked(false);
      setErrors({});
      setOriginalTableNumbers(null);
      setShowFeedbackModal(false);
    }
  }, [isOpen]);

  const handleTableSelection = (tableNumber: number) => {
    if (selectedTables.includes(tableNumber)) {
      // Removing a table - always allow
      setSelectedTables(prev => prev.filter(t => t !== tableNumber));
    } else {
      // Adding a table - validate the new combination
      const newSelection = [...selectedTables, tableNumber].sort((a, b) => a - b);
      
      // Skip validation for single table selection
      if (newSelection.length === 1) {
        setSelectedTables(newSelection);
        return;
      }
      
      // Validate multi-table selection for contiguity
      const validation = isValidTableCombination(newSelection, tableGroups as any);
      
      if (!validation.valid) {
        toast.error('Invalid Table Combination', {
          description: validation.reason,
          duration: 2000,
        });
        return; // Don't add the table
      }
      
      // Valid combination - update selection
      setSelectedTables(newSelection);
    }
  };

  const getTotalSeats = () => {
    const total = selectedTables.reduce((total, tableNumber) => {
      const table = operationalTables.find(t => t.table_number === tableNumber);
      console.log(`Table ${tableNumber}:`, table, `Seats: ${table?.seats || 0}`);
      return total + (table?.seats || 0);
    }, 0);
    console.log('Selected tables:', selectedTables);
    console.log('Available tables:', operationalTables);
    console.log('Total seats calculated:', total);
    return total;
  };

  const isWalkIn = () => {
    return formData.customer_name.trim().toLowerCase() === 'walk in';
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.customer_name.trim()) {
      newErrors.customer_name = 'Customer name is required';
    }

    // Phone is optional for walk-ins
    if (!isWalkIn() && !formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (formData.phone.trim() && !validateUKPhone(formData.phone.trim())) {
      newErrors.phone = getPhoneValidationError(formData.phone.trim());
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    if (!formData.time) {
      newErrors.time = 'Time is required';
    }

    // Validate food service hours if date and time are provided
    if (formData.date && formData.time) {
      const foodServiceValidation = validateReservationTime(
        formData.date,
        formData.time,
        location?.hours || null
      );
      
      if (!foodServiceValidation.isValid && foodServiceValidation.warnings.length > 0) {
        newErrors.time = foodServiceValidation.warnings[0];
      }
    }

    if (formData.party_size < 1) {
      newErrors.party_size = 'Party size must be at least 1';
    }

    if (selectedTables.length === 0) {
      newErrors.tables = 'Please select at least one table';
    }

    const totalSeats = getTotalSeats();
    if (totalSeats < formData.party_size) {
      const canGroupsAccommodate = canTableGroupsAccommodate(formData.party_size);
      if (canGroupsAccommodate) {
        newErrors.tables = `Selected tables (${totalSeats} seats) insufficient for ${formData.party_size} guests. Try Smart Auto-Assign for table groups.`;
      } else {
        newErrors.tables = `Selected tables (${totalSeats} seats) cannot accommodate ${formData.party_size} guests`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const attemptAutomaticConflictResolution = async (conflictingReservation: Reservation): Promise<{ success: boolean; tables?: number[]; reason?: string }> => {
    if (!companyId) return { success: false, reason: 'No company ID' };
    
    try {
      // Try direct reassignment first
      const editResult = await TableAssignmentOrchestrator.assignForReservationEdit(
        companyId,
        formData.party_size,
        formData.date,
        formData.time,
        conflictingReservation,
        false // Silent mode - no toasts
      );

      if (editResult.success && editResult.tables && editResult.tables.length > 0) {
        return { success: true, tables: editResult.tables };
      }

      // If direct reassignment fails, try full auto-assignment with space-making and rebalancing
      const autoResult = await TableAssignmentOrchestrator.autoAssignTables(
        companyId,
        formData.party_size,
        formData.date,
        formData.time,
        conflictingReservation
      );

      if (autoResult.success && autoResult.tables && autoResult.tables.length > 0) {
        return { success: true, tables: autoResult.tables };
      }

      return { success: false, reason: autoResult.reason || 'Unable to find suitable tables' };
    } catch (error) {
      console.error('Auto-resolution error:', error);
      return { success: false, reason: 'Error during automatic resolution' };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !reservation || !companyId) {
      return;
    }

    // Build the updated reservation object
    const updatedReservation: Reservation = {
      ...reservation,
      ...formData,
      customer_name: formatCustomerName(formData.customer_name),
      phone: normalizeUKPhone(formData.phone.trim()),
      table_numbers: selectedTables.length > 1 ? selectedTables : undefined,
      table_number: selectedTables.length === 1 ? selectedTables[0] : undefined,
      locked: isLocked,
      is_locked: isLocked, // Update the new field
      locked_until: isLocked ? (reservation.locked_until ?? null) : null,
      _updateSource: 'modal', // Mark as modal-initiated update
      last_manual_move_time: new Date().toISOString(), // Prove user initiated this change
    };

    // Validate for conflicts before saving
    try {
      setIsValidating(true);
      
      const result = await ReservationConflictService.validateReservation(
        {
          date: formData.date,
          time: formData.time,
          table_number: updatedReservation.table_number,
          table_numbers: updatedReservation.table_numbers,
          party_size: formData.party_size,
          notes: formData.notes
        },
        companyId,
        reservation.id // Exclude current reservation from conflict check
      );

      if (result.hasConflict) {
        // Attempt automatic conflict resolution silently
        setIsAutoResolving(true);
        const loadingToast = toast.loading('Finding alternative tables...');
        
        try {
          const resolutionResult = await attemptAutomaticConflictResolution(updatedReservation);
          
          if (resolutionResult.success && resolutionResult.tables) {
            // Success! Update tables and save
            toast.dismiss(loadingToast);
            setSelectedTables(resolutionResult.tables);
            
            const resolvedReservation: Reservation = {
              ...updatedReservation,
              table_numbers: resolutionResult.tables.length > 1 ? resolutionResult.tables : undefined,
              table_number: resolutionResult.tables.length === 1 ? resolutionResult.tables[0] : undefined,
              _updateSource: 'modal', // Mark as modal-initiated update
            };
            
            // Mark as manual move to prevent immediate re-optimization
            await TableAssignmentOrchestrator.markManualMove(reservation.id);
            
            onSave({
              ...resolvedReservation,
              phone: resolvedReservation.phone ? normalizeUKPhone(resolvedReservation.phone) : resolvedReservation.phone,
            });
            toast.success('Reservation updated', {
              description: `Automatically moved to table${resolutionResult.tables.length > 1 ? 's' : ''} ${resolutionResult.tables.join(', ')}`
            });
            return;
          }
          
          // Auto-resolution failed - show conflict modal as fallback
          toast.dismiss(loadingToast);
          setConflictResult({
            ...result,
            conflictMessage: "Can't Edit Reservation - Overlaps Existing Booking"
          });
          setIsConflictModalOpen(true);
          return;
        } finally {
          setIsAutoResolving(false);
        }
      }

      // No conflicts, proceed with save
      const hasTableChange = JSON.stringify(originalTableNumbers?.sort()) !== JSON.stringify(selectedTables.sort());
      
      if (hasTableChange && originalTableNumbers) {
        // Tables were manually changed - mark manual move timestamp
        const { TableAssignmentOrchestrator } = await import('@/services/tableAssignmentOrchestrator');
        await TableAssignmentOrchestrator.markManualMove(reservation.id);
      }
      
      // Save without feedback modal
      onSave({
        ...updatedReservation,
        phone: updatedReservation.phone ? normalizeUKPhone(updatedReservation.phone) : updatedReservation.phone,
      });
    } catch (error) {
      // Silent error handling - show user-friendly message only
      toast.error('Unable to save reservation', {
        description: 'Please check your details and try again'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleLockToggle = () => {
    // Capture current scroll position before state change
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
    setIsLocked(!isLocked);
  };

  const handleQuickStatusUpdate = async (
    newStatus: 'late' | 'seated' | 'no-show' | 'completed' | 'starters-served' | 'mains-served' | 'desserts-served' | 
      'eating-starters' | 'eating-mains' | 'eating-dessert' | 'waiting-for-mains' | 'waiting-for-desserts' | 'table-cleared' | 
      'bill-requested-waiting-to-pay',
    checkBackQuality?: 'good' | 'bad',
    feedbackNotes?: string
  ) => {
    if (!reservation) return;
    
    const now = new Date();
    let customerHistoryEvent = null;
    
    // Track customer behavior based on status change
    if (newStatus === 'late' && reservation.status === 'confirmed') {
      // First action: marking as late
      customerHistoryEvent = {
        event_type: 'marked_late',
        customer_name: reservation.customer_name,
        customer_email: reservation.email,
        customer_phone: reservation.phone,
        reservation_id: reservation.id,
        reservation_date: reservation.date,
        party_size: reservation.party_size,
        scheduled_time: reservation.time,
      };
    } else if (newStatus === 'no-show' && reservation.status === 'late') {
      // Second action from late: marking as no-show
      customerHistoryEvent = {
        event_type: 'no_show',
        customer_name: reservation.customer_name,
        customer_email: reservation.email,
        customer_phone: reservation.phone,
        reservation_id: reservation.id,
        reservation_date: reservation.date,
        party_size: reservation.party_size,
        scheduled_time: reservation.time,
      };
    } else if (newStatus === 'seated' && reservation.status === 'late') {
      // Second action from late: arrived late but seated
      const scheduledDateTime = new Date(`${reservation.date}T${reservation.time}`);
      const minutesLate = Math.round((now.getTime() - scheduledDateTime.getTime()) / (1000 * 60));
      
      customerHistoryEvent = {
        event_type: 'late_arrival',
        customer_name: reservation.customer_name,
        customer_email: reservation.email,
        customer_phone: reservation.phone,
        reservation_id: reservation.id,
        reservation_date: reservation.date,
        party_size: reservation.party_size,
        scheduled_time: reservation.time,
        actual_arrival_time: now.toISOString(),
        minutes_late: Math.max(0, minutesLate),
      };
    }
    
    // Save the event to customer history
    if (customerHistoryEvent) {
      try {
        const { error } = await supabase
          .from('customer_reservation_history')
          .insert({
            ...customerHistoryEvent,
            company_id: reservation.company_id,
          });
        
        if (error) {
          console.error('Error saving customer history:', error);
        }

        // Update customer counters based on event type
        if (customerHistoryEvent.event_type === 'late_arrival' && customerHistoryEvent.customer_phone) {
          await updateCustomerLateCount(
            reservation.company_id,
            customerHistoryEvent.customer_phone,
            customerHistoryEvent.minutes_late || 0
          );
        } else if (customerHistoryEvent.event_type === 'no_show' && customerHistoryEvent.customer_phone) {
          await updateCustomerNoShowCount(
            reservation.company_id,
            customerHistoryEvent.customer_phone
          );
        }
      } catch (err) {
        console.error('Failed to track customer behavior:', err);
      }
    }
    
    // Log check-back feedback if provided
    if (checkBackQuality && (newStatus === 'eating-starters' || newStatus === 'eating-mains' || newStatus === 'eating-dessert')) {
      const courseMap = {
        'eating-starters': 'starters',
        'eating-mains': 'mains',
        'eating-dessert': 'desserts',
      };
      
      const course = courseMap[newStatus];
      
      try {
        const { error } = await supabase
          .from('course_checkback_feedback')
          .insert({
            company_id: reservation.company_id,
            reservation_id: reservation.id,
            course: course,
            quality_rating: checkBackQuality,
            feedback_notes: feedbackNotes || null,
            staff_user_id: null,
          });
        
        if (error) {
          console.error('Error logging check-back feedback:', error);
        }
      } catch (err) {
        console.error('Failed to log check-back feedback:', err);
      }
    }
    
    // Set course served timestamps
    const updateData: any = {
      status: newStatus,
    };

    if (newStatus === 'seated') {
      updateData.seated_at = now.toISOString();
    } else if (newStatus === 'starters-served') {
      updateData.starters_served_at = now.toISOString();
    } else if (newStatus === 'mains-served') {
      updateData.mains_served_at = now.toISOString();
    } else if (newStatus === 'desserts-served') {
      updateData.desserts_served_at = now.toISOString();
    }
    
    const updatedReservation: Reservation = {
      ...reservation,
      ...formData,
      phone: formData.phone ? normalizeUKPhone(formData.phone) : formData.phone,
      ...updateData,
      table_numbers: selectedTables.length > 1 ? selectedTables : undefined,
      table_number: selectedTables.length === 1 ? selectedTables[0] : undefined,
      locked: isLocked,
      is_locked: isLocked,
    };
    
    onSave(updatedReservation);
    
    // Enhanced toast messages
    const messages = {
      'late': 'Marked as Late - Customer behavior tracked',
      'seated': customerHistoryEvent?.event_type === 'late_arrival' 
        ? `Seated - ${customerHistoryEvent.minutes_late} minutes late recorded`
        : 'Status updated to Seated',
      'no-show': 'Marked as No Show - Customer history updated',
      'completed': 'Table marked as completed - Customer visit count updated',
      'starters-served': 'Starters marked as served',
      'mains-served': 'Mains marked as served',
      'desserts-served': 'Desserts marked as served',
      'eating-starters': checkBackQuality === 'good' 
        ? 'Check-back completed - Guests happy with starters' 
        : 'Check-back completed - Feedback recorded',
      'eating-mains': checkBackQuality === 'good' 
        ? 'Check-back completed - Guests happy with mains' 
        : 'Check-back completed - Feedback recorded',
      'eating-dessert': checkBackQuality === 'good' 
        ? 'Check-back completed - Guests happy with desserts' 
        : 'Check-back completed - Feedback recorded',
    };
    
    toast.success(messages[newStatus] || `Status updated to ${newStatus}`);
  };

  const handleCheckBackGood = (course: 'starters' | 'mains' | 'desserts') => {
    const statusMap = {
      'starters': 'eating-starters' as const,
      'mains': 'eating-mains' as const,
      'desserts': 'eating-dessert' as const,
    };
    
    handleQuickStatusUpdate(statusMap[course], 'good');
  };

  const handleCheckBackBad = (course: 'starters' | 'mains' | 'desserts') => {
    setCheckBackFeedbackModal({
      isOpen: true,
      course: course,
    });
  };

  const handleCheckBackFeedbackSubmit = (notes: string) => {
    if (!checkBackFeedbackModal.course) return;
    
    const statusMap = {
      'starters': 'eating-starters' as const,
      'mains': 'eating-mains' as const,
      'desserts': 'eating-dessert' as const,
    };
    
    handleQuickStatusUpdate(
      statusMap[checkBackFeedbackModal.course], 
      'bad', 
      notes
    );
  };

  const handleExtendCourse = async (course: 'starters' | 'mains' | 'desserts') => {
    if (!reservation) return;
    
    // Change status back to eating
    const eatingStatus = getEatingStatusForCourse(course);
    const timestampField = getServedAtFieldForCourse(course);
    
    // Calculate new timestamp: extend by 5 minutes
    // Set the served_at timestamp to 5 minutes before the duration would expire
    const durationMinutes = getCourseDuration(course, formData.party_size);
    const newTimestamp = new Date();
    newTimestamp.setMinutes(newTimestamp.getMinutes() - (durationMinutes - 5));
    
    console.log(`[handleExtendCourse] Extending ${course} by 5 minutes`);
    console.log(`[handleExtendCourse] Current status: ${formData.status}, Target status: ${eatingStatus}`);
    console.log(`[handleExtendCourse] Duration: ${durationMinutes} min, New timestamp: ${newTimestamp.toISOString()}`);
    
    const updateData: any = {
      status: eatingStatus,
      [timestampField]: newTimestamp.toISOString()
    };
    
    const { error } = await supabase
      .from('reservations')
      .update(updateData)
      .eq('id', reservation.id)
      .eq('company_id', reservation.company_id);
    
    if (error) {
      console.error('[handleExtendCourse] Failed to extend time:', error);
      toast.error(`Failed to extend time: ${error.message}`);
      return;
    }
    
    console.log(`[handleExtendCourse] Successfully extended ${course} time`);
    
    // Update local form state
    setFormData({ ...formData, status: eatingStatus as any });
    
    toast.success(`Extended ${course} time by 5 minutes`);
    
    // Save to parent
    onSave({
      ...reservation,
      ...formData,
      phone: formData.phone ? normalizeUKPhone(formData.phone) : formData.phone,
      status: eatingStatus as any,
      [timestampField]: newTimestamp.toISOString(),
    });
  };

  const handleCourseCleared = async (course: 'starters' | 'mains' | 'desserts') => {
    if (!reservation) return;
    
    const nextStatus = getNextCourseStatus(course);
    
    console.log(`[handleCourseCleared] Clearing ${course}, transitioning from ${formData.status} to ${nextStatus}`);
    
    const { error } = await supabase
      .from('reservations')
      .update({ 
        status: nextStatus
      })
      .eq('id', reservation.id)
      .eq('company_id', reservation.company_id);
    
    if (error) {
      console.error('[handleCourseCleared] Failed to update status:', error);
      toast.error(`Failed to update status: ${error.message}`);
      return;
    }
    
    console.log(`[handleCourseCleared] Successfully updated to ${nextStatus}`);
    
    // Update local form state
    setFormData({ ...formData, status: nextStatus as any });
    
    // Save to parent
    onSave({
      ...reservation,
      ...formData,
      phone: formData.phone ? normalizeUKPhone(formData.phone) : formData.phone,
      status: nextStatus as any,
    });
    
    toast.success(`${course.charAt(0).toUpperCase() + course.slice(1)} cleared successfully`);
  };

  const handleBillRequested = async () => {
    if (!reservation) return;
    
    try {
      // Step 1: Find the order associated with this reservation
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, table_number, total_amount, status')
        .eq('reservation_id', reservation.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (orderError) {
        console.error('[EditReservationModal] Error fetching order:', orderError);
        toast.error('Could not find associated order');
        return;
      }

      // Check if order exists
      if (!orders || orders.length === 0) {
        // No order found - still update status but show warning
        console.warn('[EditReservationModal] No order found for reservation:', reservation.id);
        
        // Still update status
        await handleQuickStatusUpdate('bill-requested-waiting-to-pay');
        
        toast.error('No order found - status updated but no bill to print');
        return;
      }

      const order = orders[0];
      console.log('[EditReservationModal] Found order for bill:', {
        orderId: order.id,
        orderNumber: order.order_number,
        tableNumber: order.table_number,
        totalAmount: order.total_amount
      });

      // Step 2: Update reservation status
      await handleQuickStatusUpdate('bill-requested-waiting-to-pay');

      // Step 3: Print the bill/receipt
      // This will use the same function as POS print receipt
      const { printBillForOrder } = await import('@/utils/printHelpers');
      await printBillForOrder(order.id);

      toast.success(`Bill for order #${order.order_number} sent to printer`);

    } catch (error) {
      console.error('[EditReservationModal] Error in handleBillRequested:', error);
      toast.error('Failed to process bill request');
    }
  };

  // Restore scroll position after lock state changes
  useEffect(() => {
    if (scrollContainerRef.current && scrollPositionRef.current > 0) {
      const savedPosition = scrollPositionRef.current;
      // Use multiple animation frames to ensure DOM has fully settled
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = savedPosition;
            }
          }, 0);
        });
      });
    }
  }, [isLocked]);

  const handleDateSelect = (date: string) => {
    setFormData({...formData, date});
  };

  const handleTimeSelect = (time: string) => {
    setFormData({...formData, time});
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Pick a date';
    try {
      const date = new Date(dateStr);
      return format(date, 'EEE dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return 'Pick a time';
    return timeStr;
  };

  const formatEndTime = (startTime: string) => {
    if (!startTime) return '';
    const parts = startTime.split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      const endHours = hours + 2;
      const endMinutes = minutes;
      
      const formattedEndHours = endHours.toString().padStart(2, '0');
      const formattedEndMinutes = endMinutes.toString().padStart(2, '0');
      
      return `${formattedEndHours}:${formattedEndMinutes}`;
    }
    return startTime;
  };

  const endTime = formatEndTime(formData.time);
  const totalSeats = getTotalSeats();
  const isPastReservation = formData.date && formData.time 
    ? isReservationStartTimePast(formData.date, formData.time) 
    : false;

  const handlePhoneChange = (value: string) => {
    // Strip all non-digit characters immediately as user types
    const digitsOnly = value.replace(/\D/g, '');
    setFormData({...formData, phone: digitsOnly});
    setPhoneError(''); // Clear error when user starts typing
  };

  // Helper function to check if table groups can accommodate party size
  const canTableGroupsAccommodate = (partySize: number) => {
    return tableGroups.some(group => 
      group.max_combined_capacity && group.max_combined_capacity >= partySize
    );
  };

  // Check for auto-assignment capability
  useEffect(() => {
    if (formData.party_size && formData.date && formData.time && companyId) {
      const totalSeats = getTotalSeats();
      const wastedSeats = totalSeats - formData.party_size;
      const hasInsufficientSeats = selectedTables.length > 0 && totalSeats < formData.party_size;
      const hasNoTablesSelected = selectedTables.length === 0;
      const hasMultipleTables = selectedTables.length > 1;
      const isWasteful = wastedSeats >= 2;
      const tableGroupsCanAccommodate = canTableGroupsAccommodate(formData.party_size);
      
      // Enable auto-assign if:
      // 1. No tables selected OR
      // 2. Selected tables are insufficient OR 
      // 3. Using multiple tables (could be optimized) OR
      // 4. Wasting 2+ seats (could be more efficient) OR
      // 5. Table groups exist that can accommodate the party size
      setCanAutoAssign(
        hasNoTablesSelected || 
        hasInsufficientSeats || 
        hasMultipleTables || 
        isWasteful ||
        (hasInsufficientSeats && tableGroupsCanAccommodate)
      );
    } else {
      setCanAutoAssign(false);
    }
  }, [formData.party_size, formData.date, formData.time, companyId, selectedTables.length, tableGroups]);

  // Auto-trigger smart assignment when party size changes
  useEffect(() => {
    // Only auto-trigger if:
    // 1. Modal is open
    // 2. All required fields are present
    // 3. Party size is valid
    // 4. Auto-assign is enabled
    // 5. Not currently auto-assigning
    if (
      isOpen &&
      formData.party_size >= 1 && 
      formData.date && 
      formData.time && 
      companyId && 
      canAutoAssign &&
      !isAutoAssigning
    ) {
      // Debounce the auto-trigger to avoid excessive calls
      const timeoutId = setTimeout(() => {
        console.log(`🎯 AUTO-TRIGGERING smart assignment for ${formData.party_size} guests`);
        handleAutoAssign();
      }, 1000); // 1 second debounce after party size change
      
      return () => clearTimeout(timeoutId);
    }
  }, [formData.party_size, formData.date, formData.time, companyId, canAutoAssign, isOpen]);

  const handleConflictSelectAlternative = async (tableNumber: number) => {
    if (!reservation || !companyId) return;

    // Update selected tables with the alternative
    setSelectedTables([tableNumber]);
    setIsConflictModalOpen(false);
    setConflictResult(null);
  };

  const handleConflictForceOverride = () => {
    if (!reservation) return;
    
    // Proceed with save despite conflicts (admin override)
    const updatedReservation: Reservation = {
      ...reservation,
      ...formData,
      customer_name: formatCustomerName(formData.customer_name),
      phone: normalizeUKPhone(formData.phone.trim()),
      table_numbers: selectedTables.length > 1 ? selectedTables : undefined,
      table_number: selectedTables.length === 1 ? selectedTables[0] : undefined,
      locked: isLocked,
      is_locked: isLocked, // Update the new field
    };

    setIsConflictModalOpen(false);
    setConflictResult(null);
    onSave({
      ...updatedReservation,
      phone: updatedReservation.phone ? normalizeUKPhone(updatedReservation.phone) : updatedReservation.phone,
    });
  };

  const handleConflictCancel = () => {
    setIsConflictModalOpen(false);
    setConflictResult(null);
  };

  const handleAutoAssign = async () => {
    if (!companyId || !formData.date || !formData.time || formData.party_size < 1 || !reservation) {
      return;
    }

    setIsAutoAssigning(true);

    try {
      const result = await TableAssignmentOrchestrator.assignForReservationEdit(
        companyId,
        formData.party_size,
        formData.date,
        formData.time,
        reservation,
        false // Don't show toast from orchestrator
      );

      console.log('[EditReservationModal] Orchestrator result:', result);

      if (result.success && result.tables.length > 0) {
        setSelectedTables(result.tables);
        // Silent success - no toast needed
      } else {
        // Only show error if assignment completely failed
        if (!result.success) {
          toast.error(result.reason || 'Could not find optimal table assignment', { 
            description: 'Please select tables manually or try a different time'
          });
        }
      }
      
    } catch (error) {
      // Only show critical errors
      toast.error('Unable to auto-assign tables', {
        description: 'Please select tables manually'
      });
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const handleEditCustomer = async () => {
    if (!formData.phone || !companyId) {
      toast.error('Cannot edit customer', {
        description: 'Phone number is required to edit customer information'
      });
      return;
    }

    // Normalize phone number for consistent matching (same as CustomerSyncService)
    const normalizedPhone = normalizeUKPhone(formData.phone);
    
    if (!normalizedPhone) {
      toast.error('Invalid phone number', {
        description: 'Cannot lookup customer with invalid phone format'
      });
      return;
    }

    // Fetch customer details by normalized phone number
    const { data: customerData, error } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', companyId)
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (error) {
      console.error('Error fetching customer:', error);
      toast.error('Failed to load customer data');
      return;
    }

    if (!customerData) {
      toast.error('Customer not found', {
        description: 'This customer does not exist in the system'
      });
      return;
    }

    setCurrentCustomer(customerData as Customer);
    setIsEditCustomerModalOpen(true);
  };

  const handleCustomerUpdate = async (updatedCustomer: Customer) => {
    if (!companyId) return;

    try {
      const { error } = await offlineAwareUpdate('customers', updatedCustomer.id, {
        name: updatedCustomer.name,
        email: updatedCustomer.email,
        phone: updatedCustomer.phone,
        notes: updatedCustomer.notes,
        preferences: updatedCustomer.preferences,
        vip_status: updatedCustomer.vip_status,
      });

      if (error) throw error;

      // Update the reservation form data with new customer info
      setFormData(prev => ({
        ...prev,
        customer_name: updatedCustomer.name,
        phone: updatedCustomer.phone || '',
        email: updatedCustomer.email || '',
      }));

      setIsEditCustomerModalOpen(false);
      toast.success('Customer updated successfully');
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('Failed to update customer');
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent ref={scrollContainerRef} className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" disableAutoFocus={true} instantOpen={true}>
          <DialogHeader>
            <DialogTitle>Edit Reservation</DialogTitle>
          </DialogHeader>

          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
            {/* Header with customer name, contact info, edit button, and status */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold text-gray-900 border-none">{formData.customer_name}</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEditCustomer}
                    className="h-7 text-xs gap-1.5"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit Customer
                  </Button>
                </div>
                {/* Contact information */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {formData.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{formatPhoneForDisplay(formData.phone)}</span>
                    </div>
                  )}
                  {formData.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{formData.email}</span>
                    </div>
                  )}
                </div>
              </div>
              <Badge variant={formData.status === 'confirmed' ? 'default' : 
                             formData.status === 'seated' ? 'secondary' :
                             formData.status === 'completed' ? 'outline' : 'destructive'}>
                {formData.status}
              </Badge>
            </div>

            {/* Main reservation details grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Table assignment */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {selectedTables.length > 1 
                      ? `Tables ${selectedTables.join(', ')}` 
                      : selectedTables.length === 1 
                      ? `Table ${selectedTables[0]}`
                      : 'No tables selected'
                    }
                  </div>
                  <div className="text-xs text-gray-600">Table assignment</div>
                </div>
              </div>

              {/* Date and time */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-50 rounded-full">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {formData.time} - {endTime}
                  </div>
                  <div className="text-xs text-gray-600">
                    {new Date(formData.date).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Party size */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-green-50 rounded-full">
                  <Users className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {formData.party_size} {formData.party_size === 1 ? 'guest' : 'guests'}
                  </div>
                  <div className="text-xs text-gray-600">Party size</div>
                </div>
              </div>
            </div>

            {/* Status update prompt for overdue reservations */}
            {isPastReservation && formData.status === 'confirmed' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      Ready to update this reservation?
                    </div>
                    <div className="text-xs text-gray-600">
                      The reservation time has passed
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickStatusUpdate('late')}
                    >
                      Mark Late
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleQuickStatusUpdate('seated')}
                    >
                      Mark Seated
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Status update prompt for late reservations */}
            {formData.status === 'late' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-amber-900 mb-1">
                      Update late reservation status
                    </div>
                    <div className="text-xs text-amber-700">
                      Has the guest arrived or should they be marked as no-show?
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickStatusUpdate('no-show')}
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      No Show
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleQuickStatusUpdate('seated')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Seated
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Status update prompt for table-complete reservations */}
            {formData.status === 'table-complete' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-900 mb-1">
                      Mark guests as departed?
                    </div>
                    <div className="text-xs text-green-700">
                      Guests are leaving - mark reservation as completed
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleQuickStatusUpdate('completed')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Mark as Completed
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Status update prompt for starters ready in kitchen */}
            {formData.status === 'starters-ready-in-kitchen' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900 mb-1">
                      Starters ready in kitchen
                    </div>
                    <div className="text-xs text-blue-700">
                      Mark starters as served to acknowledge and remove kitchen notification
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleQuickStatusUpdate('starters-served')}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Starters Served
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Status update prompt for mains ready in kitchen */}
            {formData.status === 'mains-ready-in-kitchen' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900 mb-1">
                      Mains ready in kitchen
                    </div>
                    <div className="text-xs text-blue-700">
                      Mark mains as served to acknowledge and remove kitchen notification
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleQuickStatusUpdate('mains-served')}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Mains Served
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Status update prompt for desserts ready in kitchen */}
            {formData.status === 'desserts-ready-in-kitchen' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900 mb-1">
                      Desserts ready in kitchen
                    </div>
                    <div className="text-xs text-blue-700">
                      Mark desserts as served to acknowledge and remove kitchen notification
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleQuickStatusUpdate('desserts-served')}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Desserts Served
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Status update prompt for starters check-back */}
            {formData.status === 'requires-check-back-on-starters' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-fuchsia-50 rounded-lg border border-fuchsia-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-fuchsia-900 mb-1">
                      Check back on starters
                    </div>
                    <div className="text-xs text-fuchsia-700">
                      How is everything with the starters?
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCheckBackBad('starters')}
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      Bad ✗
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCheckBackGood('starters')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Good ✓
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Status update prompt for mains check-back */}
            {formData.status === 'requires-check-back-on-mains' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-fuchsia-50 rounded-lg border border-fuchsia-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-fuchsia-900 mb-1">
                      Check back on mains
                    </div>
                    <div className="text-xs text-fuchsia-700">
                      How is everything with the mains?
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCheckBackBad('mains')}
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      Bad ✗
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCheckBackGood('mains')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Good ✓
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Status update prompt for desserts check-back */}
            {formData.status === 'requires-check-back-on-desserts' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-fuchsia-50 rounded-lg border border-fuchsia-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-fuchsia-900 mb-1">
                      Check back on desserts
                    </div>
                    <div className="text-xs text-fuchsia-700">
                      How is everything with the desserts?
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCheckBackBad('desserts')}
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      Bad ✗
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCheckBackGood('desserts')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Good ✓
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick action for eating starters - manual clear */}
            {formData.status === 'eating-starters' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-900 mb-1">
                      Guests eating starters
                    </div>
                    <div className="text-xs text-green-700">
                      Mark table as cleared when guests finish
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleQuickStatusUpdate('waiting-for-mains')}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      Table Cleared
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Status update prompt for clear starters */}
            {formData.status === 'clear-starters' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-orange-900 mb-1">
                      Time to clear starters
                    </div>
                    <div className="text-xs text-orange-700">
                      Table should be ready for next course
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleExtendCourse('starters')}
                      variant="outline"
                      className="border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      +5 Min
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCourseCleared('starters')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Cleared ✓
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick action for eating mains - manual clear */}
            {formData.status === 'eating-mains' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-900 mb-1">
                      Guests eating mains
                    </div>
                    <div className="text-xs text-green-700">
                      Mark table as cleared when guests finish
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleQuickStatusUpdate('waiting-for-desserts')}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Table Cleared
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Status update prompt for clear mains */}
            {formData.status === 'clear-mains' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900 mb-1">
                      Time to clear mains
                    </div>
                    <div className="text-xs text-blue-700">
                      Table should be ready for next course
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleExtendCourse('mains')}
                      variant="outline"
                      className="border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      +5 Min
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCourseCleared('mains')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Cleared ✓
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick action for eating dessert - manual clear */}
            {formData.status === 'eating-dessert' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-900 mb-1">
                      Guests eating dessert
                    </div>
                    <div className="text-xs text-green-700">
                      Mark table as cleared when guests finish
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleQuickStatusUpdate('table-cleared')}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      Table Cleared
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Status update prompt for clear desserts */}
            {formData.status === 'clear-desserts' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-purple-900 mb-1">
                      Time to clear desserts
                    </div>
                    <div className="text-xs text-purple-700">
                      Table should be cleared and ready for next service
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleExtendCourse('desserts')}
                      variant="outline"
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                    >
                      +5 Min
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCourseCleared('desserts')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Cleared ✓
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick action for table cleared - bill requested */}
            {formData.status === 'table-cleared' && (
              <div className="border-t pt-4 mb-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900 mb-1">
                      Table cleared and ready for bill
                    </div>
                    <div className="text-xs text-blue-700">
                      Print bill and update status when guest requests payment
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleBillRequested()}
                      className="bg-fuchsia-600 hover:bg-fuchsia-700"
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Bill Requested
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Critical alerts section */}
            {((formData.has_allergens && formData.allergens && formData.allergens.length > 0) || 
              (formData.notes && detectAccessibilityNeeds({ notes: formData.notes } as any).needsAccessible) || 
              isLocked) && (
              <div className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Important Alerts</h4>
                
                {/* Allergen information */}
                {formData.has_allergens && formData.allergens && formData.allergens.length > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center justify-center w-6 h-6 bg-amber-100 rounded-full flex-shrink-0 mt-0.5">
                      <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-amber-800">Allergies Noted</div>
                      <div className="text-sm text-amber-700 mt-1">
                        {formData.allergens.join(', ')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Accessibility needs */}
                {formData.notes && detectAccessibilityNeeds({ notes: formData.notes } as any).needsAccessible && (
                  <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full flex-shrink-0 mt-0.5">
                      <Accessibility className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-blue-800">Accessibility Required</div>
                      <div className="text-sm text-blue-700 mt-1">
                        Wheelchair accessible seating needed
                      </div>
                    </div>
                  </div>
                )}

                {/* Locked reservation */}
                {isLocked && (
                  <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center justify-center w-6 h-6 bg-orange-100 rounded-full flex-shrink-0 mt-0.5">
                      <Lock className="h-3.5 w-3.5 text-orange-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-orange-800">Reservation Locked</div>
                      <div className="text-sm text-orange-700 mt-1">
                        This reservation cannot be moved on the timeline
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

            <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">

              <div>
                <Label htmlFor="party_size">Party Size *</Label>
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({...formData, party_size: Math.max(1, formData.party_size - 1)})}
                    disabled={formData.party_size <= 1}
                    className="h-9 w-9 p-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    max="500"
                    value={formData.party_size}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        // Allow empty field while typing
                        setFormData({...formData, party_size: '' as any});
                      } else {
                        setFormData({...formData, party_size: Math.max(1, parseInt(value) || 1)});
                      }
                    }}
                    onBlur={(e) => {
                      // Ensure minimum value when field loses focus
                      const value = parseInt(e.target.value) || 1;
                      setFormData({...formData, party_size: Math.max(1, value)});
                    }}
                    className={`flex-1 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${errors.party_size ? 'border-red-500' : ''}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({...formData, party_size: Math.min(500, formData.party_size + 1)})}
                    disabled={formData.party_size >= 500}
                    className="h-9 w-9 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {errors.party_size && (
                  <p className="text-red-500 text-xs mt-1">{errors.party_size}</p>
                )}
              </div>

              <div>
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: Reservation['status']) =>
                    setFormData({...formData, status: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no-show">No Show</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="seated">Seated</SelectItem>
                  <SelectItem value="waiting-for-order">Waiting for Order</SelectItem>
                  <SelectItem value="waiting-for-starters">Waiting for Starters</SelectItem>
                  <SelectItem value="starters-ready-in-kitchen">Starters Ready in Kitchen</SelectItem>
                  <SelectItem value="starters-served">Starters Served</SelectItem>
                  <SelectItem value="requires-check-back-on-starters">Requires Check Back on Starters</SelectItem>
                  <SelectItem value="eating-starters">Eating Starters</SelectItem>
                  <SelectItem value="clear-starters">Clear Starters</SelectItem>
                  <SelectItem value="waiting-for-mains">Waiting for Mains</SelectItem>
                  <SelectItem value="mains-ready-in-kitchen">Mains Ready In Kitchen</SelectItem>
                  <SelectItem value="mains-served">Mains Served</SelectItem>
                  <SelectItem value="requires-check-back-on-mains">Requires Check Back on Mains</SelectItem>
                  <SelectItem value="eating-mains">Eating Mains</SelectItem>
                  <SelectItem value="clear-mains">Clear Mains</SelectItem>
                  <SelectItem value="waiting-for-desserts">Waiting for Desserts</SelectItem>
                  <SelectItem value="desserts-ready-in-kitchen">Desserts Ready in Kitchen</SelectItem>
                  <SelectItem value="desserts-served">Desserts Served</SelectItem>
                  <SelectItem value="requires-check-back-on-desserts">Requires Check Back on Desserts</SelectItem>
                  <SelectItem value="eating-dessert">Eating Dessert</SelectItem>
                  <SelectItem value="clear-desserts">Clear Desserts</SelectItem>
                  <SelectItem value="table-cleared">Table Cleared</SelectItem>
                  <SelectItem value="bill-requested-waiting-to-pay">Bill Requested/Waiting to Pay</SelectItem>
                  <SelectItem value="table-complete">Table Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDateModalOpen(true)}
                    className={`flex-1 justify-start text-left font-normal ${
                      !formData.date && "text-muted-foreground"
                    } ${errors.date ? 'border-red-500' : ''}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDisplayDate(formData.date)}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setFormData({...formData, date: today});
                    }}
                    className="px-3 text-xs"
                  >
                    Today
                  </Button>
                </div>
                {errors.date && (
                  <p className="text-red-500 text-xs mt-1">{errors.date}</p>
                )}
              </div>

              <div>
                <Label htmlFor="time">Time *</Label>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsTimeModalOpen(true)}
                    className={`flex-1 justify-start text-left font-normal ${
                      !formData.time && "text-muted-foreground"
                    } ${errors.time ? 'border-red-500' : ''}`}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {formatDisplayTime(formData.time)}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextSlot = getNextFifteenMinuteSlot();
                      setFormData({...formData, time: nextSlot});
                    }}
                    className="px-3 text-xs"
                  >
                    Now
                  </Button>
                </div>
                {errors.time && (
                  <p className="text-red-500 text-xs mt-1">{errors.time}</p>
                )}
              </div>
            </div>

            <div>
              <Label>Select Tables *</Label>
              <div className="mt-2 border rounded-md p-2 bg-white">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(90px,1fr))] gap-1">
                  {operationalTables.map((table) => {
                    const isSelected = selectedTables.includes(table.table_number);
                    const testSelection = [...selectedTables, table.table_number].sort((a, b) => a - b);
                    const validation = isValidTableCombination(testSelection, tableGroups as any);
                    const wouldBeInvalid = !isSelected && 
                      testSelection.length > 1 && 
                      !validation.valid;
                    
                    return (
                      <Badge
                        key={table.id}
                        variant={isSelected ? "default" : "outline"}
                        className={`px-2 py-1 text-xs font-medium transition-colors justify-center whitespace-nowrap ${
                          isSelected
                            ? 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
                            : wouldBeInvalid
                            ? 'bg-white text-gray-400 border border-gray-200 opacity-50 cursor-not-allowed'
                            : 'bg-white text-black border border-gray-300 hover:bg-gray-50 cursor-pointer'
                        }`}
                        onClick={() => !wouldBeInvalid && handleTableSelection(table.table_number)}
                        title={
                          wouldBeInvalid
                            ? 'This table cannot be combined with your current selection (tables must be consecutive in the same group)'
                            : `${table.table_name || `Table ${table.table_number}`} (${table.seats} seats)`
                        }
                      >
                        {table.table_name || `T${table.table_number}`} ({table.seats})
                      </Badge>
                    );
                  })}
                </div>
              </div>
              {selectedTables.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  Selected: {selectedTables.join(', ')} (Total: {totalSeats} seats)
                  {formData.party_size > totalSeats && (
                    <span className="text-red-500 ml-2">
                      ⚠️ Not enough seats for {formData.party_size} guests
                    </span>
                  )}
                </div>
              )}
              {errors.tables && (
                <p className="text-red-500 text-xs mt-1">{errors.tables}</p>
              )}
            </div>

            {/* Allergen Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="has_allergens">Any Allergies?</Label>
                <Switch
                  id="has_allergens"
                  checked={formData.has_allergens}
                  onCheckedChange={(checked) => {
                    setFormData({
                      ...formData,
                      has_allergens: checked,
                      allergens: checked ? formData.allergens : []
                    });
                  }}
                />
              </div>
              
              {formData.has_allergens && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Select Allergens</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border rounded-lg bg-muted/30">
                    {ALLERGEN_LIST.map((allergen) => (
                      <div key={allergen} className="flex items-center space-x-2">
                        <Checkbox
                          id={`allergen-${allergen}`}
                          checked={formData.allergens.includes(allergen)}
                          onCheckedChange={(checked) => {
                            const newAllergens = checked
                              ? [...formData.allergens, allergen]
                              : formData.allergens.filter(a => a !== allergen);
                            setFormData({...formData, allergens: newAllergens});
                          }}
                        />
                        <Label 
                          htmlFor={`allergen-${allergen}`}
                          className="text-sm cursor-pointer"
                        >
                          {allergen}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                ref={notesTextareaRef}
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                onFocus={() => {
                  setTimeout(() => {
                    notesTextareaRef.current?.scrollIntoView({ 
                      behavior: 'smooth', 
                      block: 'end' 
                    });
                  }, 100);
                }}
                placeholder="Special requests, allergies, occasions, etc."
                rows={3}
              />
            </div>

            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600 text-sm">{errors.general}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleLockToggle}
                className={`flex items-center gap-2 ${isLocked ? 'text-amber-600 border-amber-300' : ''}`}
              >
                {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                {isLocked ? 'Unlock' : 'Lock'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isValidating || isAutoResolving}>
                {isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : isAutoResolving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  'Update Reservation'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DatePickerModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onDateSelect={handleDateSelect}
        currentDate={formData.date}
      />

      <TimeSelectionModal
        isOpen={isTimeModalOpen}
        onClose={() => setIsTimeModalOpen(false)}
        onTimeSelect={handleTimeSelect}
        currentTime={formData.time}
      />

      <ConflictValidationModal
        open={isConflictModalOpen}
        onOpenChange={setIsConflictModalOpen}
        conflictResult={conflictResult}
        onSelectAlternative={handleConflictSelectAlternative}
        onForceOverride={handleConflictForceOverride}
        onCancel={handleConflictCancel}
        onSmartAssign={(tables) => {
          setSelectedTables(tables);
          setIsConflictModalOpen(false);
        }}
        companyId={companyId}
        partySize={formData.party_size}
        date={formData.date}
        time={formData.time}
      />

      <TableMoveFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        reservationId={reservation?.id || ''}
        oldTableNumbers={originalTableNumbers}
        newTableNumbers={newTableNumbers}
        companyId={companyId || ''}
      />

      <CheckBackFeedbackModal
        isOpen={checkBackFeedbackModal.isOpen}
        onClose={() => setCheckBackFeedbackModal({ isOpen: false, course: null })}
        onSubmit={handleCheckBackFeedbackSubmit}
        course={checkBackFeedbackModal.course || 'starters'}
      />

      <Dialog open={isEditCustomerModalOpen} onOpenChange={setIsEditCustomerModalOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          {currentCustomer && (
            <CustomerForm
              customer={currentCustomer}
              onSave={handleCustomerUpdate}
              onCancel={() => setIsEditCustomerModalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
