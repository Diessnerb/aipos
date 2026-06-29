import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { CalendarIcon, Clock, Plus, Minus, Lock, Unlock, Eye, EyeOff, Search, UserCheck, UserPlus, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useTablesQuery } from '@/hooks/useTablesQuery';
import { useTableGroups } from '@/hooks/useTableGroups';
// useReservationSpaceAnalysis hook removed - auto-assignment now uses full pipeline
import { AlternativeTimeService } from '@/services/alternativeTimeService';
import { Table } from '@/types/table';
import { TimeSelectionModal } from './TimeSelectionModal';
import { DatePickerModal } from './DatePickerModal';

import { normalizeUKPhone, validateUKPhone, formatPhoneForDisplay, getPhoneValidationError } from '@/utils/phoneUtils';
import { getNextFifteenMinuteSlot } from '@/utils/timeUtils';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ALLERGEN_LIST } from '@/utils/allergens';
import { TableAssignmentOrchestrator } from '@/services/tableAssignmentOrchestrator';
import { ReservationConflictService, ConflictValidationResult } from '@/services/reservationConflictService';
import { SpaceMakingAnalysisService } from '@/services/spaceMakingAnalysisService';
import RealTimePresenceIndicator from './RealTimePresenceIndicator';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import { isValidTableCombination } from '@/utils/tableGroupUtils';
import { useReservationsQuery } from '@/hooks/useReservationsQuery';
import { Reservation } from '@/types/reservation';
import { getDeviceInfo } from '@/utils/deviceDetection';
import { validateReservationTime, getDayOfWeekFromDate } from '@/utils/foodServiceValidation';
import { useCompanyLocation } from '@/hooks/useCompanyLocation';
import { useCustomersQuery } from '@/hooks/useCustomersQuery';
import { useDebounce } from '@/hooks/useDebounce';

// Statuses that indicate a table is currently occupied and unavailable
const OCCUPIED_STATUSES = [
  'seated',
  'waiting-for-order',
  'waiting-for-starters',
  'starters-ready-in-kitchen',
  'starters-served',
  'requires-check-back-on-starters',
  'eating-starters',
  'clear-starters',
  'waiting-for-mains',
  'mains-ready-in-kitchen',
  'mains-served',
  'requires-check-back-on-mains',
  'eating-mains',
  'clear-mains',
  'waiting-for-desserts',
  'desserts-ready-in-kitchen',
  'desserts-served',
  'requires-check-back-on-desserts',
  'eating-dessert',
  'clear-desserts',
  'table-cleared',
  'bill-requested-waiting-to-pay'
] as const;

interface NewReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reservationData: {
    customer_name: string;
    party_size: number;
    phone: string;
    email: string;
    date: string;
    time: string;
    table_number?: number;
    table_numbers?: number[];
    status: 'confirmed' | 'pending' | 'cancelled' | 'no-show' | 'completed' | 'late' | 'seated' |
      'waiting-for-order' | 'waiting-for-starters' | 'starters-ready-in-kitchen' | 'starters-served' |
      'requires-check-back-on-starters' | 'eating-starters' | 'clear-starters' | 'waiting-for-mains' |
      'mains-ready-in-kitchen' | 'mains-served' | 'requires-check-back-on-mains' | 'eating-mains' |
      'clear-mains' | 'waiting-for-desserts' | 'desserts-ready-in-kitchen' | 'desserts-served' |
      'requires-check-back-on-desserts' | 'eating-dessert' | 'clear-desserts' | 'table-cleared' |
      'bill-requested-waiting-to-pay' | 'table-complete';
    notes?: string;
    has_allergens?: boolean;
    allergens?: string[];
  }) => void;
  defaults?: {
    tableNumber: number;
    startTime: string;
    date: string;
  };
  isWalkIn?: boolean;
}

export const NewReservationModal: React.FC<NewReservationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  defaults,
  isWalkIn = false,
}) => {
  const { tables: allTables } = useTablesQuery();
  const { tableGroups, fetchTableGroups } = useTableGroups();
  const { companyId } = useAuth();
  const { location } = useCompanyLocation();
  
  // Fetch current reservations to check for occupied tables
  const { reservations: allReservations } = useReservationsQuery();
  
  // Filter operational tables - exclude temporarily_removed but keep out_of_service for display as disabled
  const operationalTables = allTables.filter(t => 
    t.is_active && 
    (t.service_status !== 'temporarily_removed')
  );
  const [selectedTables, setSelectedTables] = useState<number[]>([]);
  const [formData, setFormData] = useState({
    customer_name: '',
    party_size: 2,
    phone: '',
    email: '',
    date: '',
    time: '',
    table_number: 0,
    status: 'confirmed' as 'confirmed' | 'pending' | 'cancelled' | 'no-show' | 'completed' | 'late' | 'seated' |
      'waiting-for-order' | 'waiting-for-starters' | 'starters-ready-in-kitchen' | 'starters-served' |
      'requires-check-back-on-starters' | 'eating-starters' | 'clear-starters' | 'waiting-for-mains' |
      'mains-ready-in-kitchen' | 'mains-served' | 'requires-check-back-on-mains' | 'eating-mains' |
      'clear-mains' | 'waiting-for-desserts' | 'desserts-ready-in-kitchen' | 'desserts-served' |
      'requires-check-back-on-desserts' | 'eating-dessert' | 'clear-desserts' | 'table-cleared' |
      'bill-requested-waiting-to-pay' | 'table-complete',
    notes: '',
    has_allergens: false,
    allergens: [] as string[]
  });

  // Enhanced state management for bulletproof validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ConflictValidationResult | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [canAutoAssign, setCanAutoAssign] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [hasFailedAutoAssign, setHasFailedAutoAssign] = useState(false);
  const [showAvailabilityView, setShowAvailabilityView] = useState(false);
  const [autoAssignedTables, setAutoAssignedTables] = useState<number[]>([]);
  const [userAdjustedTables, setUserAdjustedTables] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ tableNumber: number; conflicts: Reservation[] } | null>(null);
  const [isConfirmingMove, setIsConfirmingMove] = useState(false);
  
  // Customer lookup state
  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  
  // Get customers for lookup
  const { customers } = useCustomersQuery();
  
  // Debounce phone input to avoid excessive lookups
  const debouncedPhone = useDebounce(phoneInput, 300);
  
  // Track which fields have been touched (for auto-clear behavior on walk-ins)
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  
  // Refs for scroll position preservation
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const previousPartySizeRef = useRef<number>(formData.party_size);
  
  // Track last failed search to prevent duplicate toasts
  const lastFailedSearchRef = useRef<string>('');
  
  // Helper: compare two sorted arrays
  const arraysEqual = (a: number[], b: number[]): boolean => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort((x, y) => x - y);
    const sortedB = [...b].sort((x, y) => x - y);
    return sortedA.every((val, idx) => val === sortedB[idx]);
  };
  
  // Helper function to get detailed table occupancy status
  const getTableOccupancyStatus = (tableNumber: number): {
    isOccupied: boolean;
    canBeMoved: boolean;
    conflictingReservations: Reservation[];
  } => {
    if (!allReservations || allReservations.length === 0) {
      return { isOccupied: false, canBeMoved: false, conflictingReservations: [] };
    }
    
    const selectedDate = formData.date;
    const selectedTime = formData.time;
    
    if (!selectedDate || !selectedTime) {
      return { isOccupied: false, canBeMoved: false, conflictingReservations: [] };
    }
    
    // Parse selected time (HH:MM)
    const [selectedHour, selectedMinute] = selectedTime.split(':').map(Number);
    const selectedMinutes = selectedHour * 60 + selectedMinute;
    const selectedEndMinutes = selectedMinutes + 120; // Assume 2 hour duration
    
    const conflictingReservations: Reservation[] = [];
    
    // Check if table is in an active reservation
    for (const reservation of allReservations) {
      // Only check reservations on the same date
      if (reservation.date !== selectedDate) continue;
      
      // Check if this reservation uses the table
      const reservationTables = reservation.table_numbers || 
        (reservation.table_number ? [reservation.table_number] : []);
      
      if (!reservationTables.includes(tableNumber)) continue;
      
      // Parse reservation time
      const [resHour, resMinute] = reservation.time.split(':').map(Number);
      const resStartMinutes = resHour * 60 + resMinute;
      
      // Calculate end time
      let resEndMinutes: number;
      if (reservation.end_time) {
        const [endHour, endMinute] = reservation.end_time.split(':').map(Number);
        resEndMinutes = endHour * 60 + endMinute;
      } else {
        resEndMinutes = resStartMinutes + 120; // Default 2 hours
      }
      
      // Check for time overlap
      const hasOverlap = (
        (selectedMinutes >= resStartMinutes && selectedMinutes < resEndMinutes) ||
        (selectedEndMinutes > resStartMinutes && selectedEndMinutes <= resEndMinutes) ||
        (selectedMinutes <= resStartMinutes && selectedEndMinutes >= resEndMinutes)
      );
      
      if (hasOverlap) {
        conflictingReservations.push(reservation);
      }
    }
    
    if (conflictingReservations.length === 0) {
      return { isOccupied: false, canBeMoved: false, conflictingReservations: [] };
    }
    
    // Determine if conflicts can be moved
    const allMovable = conflictingReservations.every(res => {
      // Can be moved if status is movable AND not currently seated/in-service
      const isMovableStatus = ['confirmed', 'pending', 'late'].includes(res.status);
      const isNotSeated = !OCCUPIED_STATUSES.includes(res.status as any);
      
      return isMovableStatus && isNotSeated;
    });
    
    return {
      isOccupied: true,
      canBeMoved: allMovable,
      conflictingReservations
    };
  };
  
  // Helper: Get minutes until reservation starts
  const getMinutesUntilStart = (date: string, time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    const reservationDate = new Date(date);
    reservationDate.setHours(hours, minutes, 0, 0);
    
    const now = new Date();
    const diffMs = reservationDate.getTime() - now.getTime();
    return Math.floor(diffMs / (1000 * 60));
  };
  
  // Helper: Get conflicting reservations for a table
  const getConflictingReservations = (tableNumber: number): Reservation[] => {
    return getTableOccupancyStatus(tableNumber).conflictingReservations;
  };
  
  // Helper: Attempt to move conflicting reservations
  const attemptToMoveReservations = async (
    conflictingReservations: Reservation[],
    targetTables: number[]
  ): Promise<boolean> => {
    if (!companyId || conflictingReservations.length === 0) return false;
    
    try {
      console.log(`🔄 Force moving ${conflictingReservations.length} reservation(s) off T${targetTables.join(',')}`);
      console.log(`📋 Conflicting reservations:`, conflictingReservations.map(r => 
        `${r.customer_name} (${r.party_size} guests)`
      ).join(', '));
      
      const result = await tryMakeSpaceForReservation(
        targetTables,
        formData.date,
        formData.time,
        conflictingReservations.map(r => r.id) // Pass IDs of reservations to force move
      );
      
      return result;
    } catch (error) {
      console.error('Error moving reservations:', error);
      return false;
    }
  };
  
  // TIER 2: Alternative Time Suggestion State
  const [showAlternativeTimeModal, setShowAlternativeTimeModal] = useState(false);
  const [suggestedAlternativeTime, setSuggestedAlternativeTime] = useState<string | null>(null);
  const [alternativeTimeReason, setAlternativeTimeReason] = useState<string>('');
  
  // Real-time presence tracking
  const [isBookingInProgress, setIsBookingInProgress] = useState(false);

  // Legacy state names for compatibility
  const conflictResult = validationResult;
  const setConflictResult = setValidationResult;
  const isConflictModalOpen = showConflictModal;
  const setIsConflictModalOpen = setShowConflictModal;

  // Tables are now loaded via useTableManagement hook

  // Update form when defaults change or walk-in mode
  useEffect(() => {
    if (isOpen) {
      if (isWalkIn) {
        // Pre-fill for walk-in mode
        const today = new Date().toISOString().split('T')[0];
        const currentTime = getNextFifteenMinuteSlot();
        setFormData({
          customer_name: 'Walk In',
          party_size: 2,
          phone: '',
          email: '',
          date: today,
          time: currentTime,
          table_number: 0,
          status: 'seated',
          notes: '',
          has_allergens: false,
          allergens: []
        });
        setSelectedTables([]);
        setTouchedFields(new Set()); // Reset touched fields for walk-in
        setPhoneInput('');
        setFoundCustomer(null);
      } else if (defaults) {
        // Pre-select the clicked table from timeline
        console.log(`🎯 Modal opened for T${defaults.tableNumber} at ${defaults.startTime} - pre-selecting table`);
        setFormData({
          customer_name: '',
          party_size: 2,
          phone: '',
          email: '',
          date: defaults.date,
          time: defaults.startTime,
          table_number: defaults.tableNumber,
          status: 'confirmed',
          notes: '',
          has_allergens: false,
          allergens: []
        });
        
        // Pre-select the clicked table
        setSelectedTables([defaults.tableNumber]);
        setPhoneInput('');
        setFoundCustomer(null);
      } else {
        // Fresh modal - leave date/time blank for manual entry
        setFormData({
          customer_name: '',
          party_size: 2,
          phone: '',
          email: '',
          date: '',
          time: '',
          table_number: 0,
          status: 'confirmed',
          notes: '',
          has_allergens: false,
          allergens: []
        });
        setSelectedTables([]);
        setPhoneInput('');
        setFoundCustomer(null);
      }
    }
  }, [defaults, isOpen, isWalkIn]);

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
        table_number: 0,
        status: 'confirmed',
        notes: '',
        has_allergens: false,
        allergens: []
      });
      setSelectedTables([]);
      setErrors({});
      setIsLocked(false);
      setHasFailedAutoAssign(false);
      setTouchedFields(new Set());
      previousPartySizeRef.current = 2;
      setSuggestedAlternativeTime(null);
      setShowAlternativeTimeModal(false);
      setFoundCustomer(null);
      setPhoneInput('');
      setIsSearchingCustomer(false);
    }
  }, [isOpen]);

  // Customer lookup effect - triggered when phone changes
  useEffect(() => {
    // Skip lookup for walk-ins or if no phone entered
    if (isWalkIn || !debouncedPhone || !companyId) {
      setFoundCustomer(null);
      return;
    }

    // Normalize the phone number
    const normalizedPhone = normalizeUKPhone(debouncedPhone);
    
    if (!normalizedPhone || normalizedPhone.length !== 11) {
      setFoundCustomer(null);
      return;
    }

    // Search for customer with this phone number
    setIsSearchingCustomer(true);
    
    const customerList = Array.isArray(customers) ? customers : [];
    const customer = customerList.find((c: any) => 
      c.phone && normalizeUKPhone(c.phone) === normalizedPhone
    );

    if (customer) {
      console.log('✅ Found existing customer:', customer.name);
      setFoundCustomer(customer);
      
      // Auto-fill name and email from found customer
      setFormData(prev => ({
        ...prev,
        customer_name: customer.name,
        email: customer.email || '',
        phone: normalizedPhone,
      }));
    } else {
      console.log('ℹ️ No customer found for phone:', normalizedPhone);
      setFoundCustomer(null);
      
      // Only update phone, leave name/email for manual entry
      setFormData(prev => ({
        ...prev,
        phone: normalizedPhone,
      }));
    }
    
    setIsSearchingCustomer(false);
  }, [debouncedPhone, customers, companyId, isWalkIn]);

  const handleTableSelection = async (tableNumber: number) => {
    // If user clicks a table while in availability view, clear previous selections
    // but continue to check if table is occupied (don't return early)
    if (showAvailabilityView) {
      setShowAvailabilityView(false);
      setAutoAssignedTables([]); // Clear system suggestions
      setSelectedTables([]); // Clear selection to allow occupancy check to run
      // Continue execution to trigger move confirmation if table is occupied
    }
    
    // Block manual selection during auto-assignment
    if (isAutoAssigning) {
      console.log('⚠️ Blocking manual table selection during auto-assignment');
      return;
    }
    
    // Mark that user has manually adjusted tables
    setUserAdjustedTables(true);
    
    if (selectedTables.includes(tableNumber)) {
      // Removing a table - always allow
      setSelectedTables(prev => prev.filter(t => t !== tableNumber));
      return;
    }
    
    // Adding a table - check for conflicts
    const occupancyStatus = getTableOccupancyStatus(tableNumber);
    
    if (!occupancyStatus.isOccupied) {
      // No conflicts - proceed with normal selection
      const newSelection = [...selectedTables, tableNumber].sort((a, b) => a - b);
      
      // Validate multi-table selection for contiguity (if more than 1 table)
      if (newSelection.length > 1) {
        const validation = isValidTableCombination(newSelection, tableGroups as any);
        
        if (!validation.valid) {
          toast.error('Invalid Table Combination', {
            description: validation.reason,
            duration: 2000,
          });
          return;
        }
      }
      
      setSelectedTables(newSelection);
      return;
    }
    
    // Table is occupied - check if conflicts can be moved
    const { canBeMoved, conflictingReservations } = occupancyStatus;
    
    if (canBeMoved && conflictingReservations.length > 0) {
      // Ask for confirmation before moving existing reservations
      setPendingMove({ tableNumber, conflicts: conflictingReservations });
      return;
    } else {
      // Some conflicts are immovable (seated or <10 min away)
      const immovableReservations = conflictingReservations.filter(res => {
        const isImmovableStatus = OCCUPIED_STATUSES.includes(res.status as any);
        if (isImmovableStatus) return true;
        
        const minutesUntil = getMinutesUntilStart(res.date, res.time);
        return minutesUntil <= 10;
      });
      
      if (immovableReservations.length > 0) {
        toast.warning(`Table ${tableNumber} unavailable`, {
          description: `${immovableReservations.length} guest(s) are seated or arriving within 10 minutes`
        });
      } else {
        toast.error(`Table ${tableNumber} is occupied`, {
          description: 'Please choose a different table'
        });
      }
    }
  };

  const getTotalSeats = () => {
    return selectedTables.reduce((total, tableNumber) => {
      const table = operationalTables.find(t => t.table_number === tableNumber);
      return total + (table?.seats || 0);
    }, 0);
  };

  // Suggest the best-fitting ideal group for current party size
  const getIdealGroupSuggestion = (): { tables: number[]; totalSeats: number } | null => {
    if (!tableGroups || !Array.isArray(tableGroups)) return null;
    let best: { tables: number[]; totalSeats: number } | null = null;
    for (const group of tableGroups as any[]) {
      const nums: number[] | undefined = group?.table_numbers;
      if (!nums || nums.length === 0) continue;
      const seats = nums.reduce((sum, n) => {
        const t = operationalTables.find(tt => tt.table_number === n);
        return sum + (t?.seats || 0);
      }, 0);
      if (seats >= formData.party_size) {
        if (!best || seats < best.totalSeats) {
          best = { tables: nums, totalSeats: seats };
        }
      }
    }
    return best;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.customer_name.trim()) {
      newErrors.customer_name = 'Customer name is required';
    }

    // Phone is optional for walk-ins
    if (!isWalkIn && !formData.phone.trim()) {
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
      newErrors.tables = isLocked 
        ? 'Please select at least one table (auto-assignment is locked)' 
        : 'No tables available - try a different time or unlock auto-assignment';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-assignment now happens proactively via useEffect
    
    if (!validateForm()) {
      return;
    }

    if (!companyId) {
      toast.error('Company ID not found');
      return;
    }

    setIsValidating(true);

    try {
      // Validate for conflicts before saving
      const result = await ReservationConflictService.validateReservation(
        {
          date: formData.date,
          time: formData.time,
          table_number: selectedTables.length === 1 ? selectedTables[0] : undefined,
          table_numbers: selectedTables.length > 1 ? selectedTables : undefined,
          party_size: formData.party_size,
          notes: formData.notes
        },
        companyId
      );

      if (result.hasConflict) {
        // Try to make space by moving conflicting reservations
        console.log(`🎯 Conflict detected on T${selectedTables.join(',')} - attempting to make space`);
        const spaceMadeSuccess = await tryMakeSpaceForReservation(
          selectedTables,
          formData.date,
          formData.time
        );
        
        if (spaceMadeSuccess) {
          // Space made successfully - force save
          console.log(`✅ Space made successfully - proceeding with save`);
          await saveReservation();
          return;
        } else {
          // Could not make space - show error
          console.log(`❌ Could not make space - showing error to user`);
          toast.error('Tables unavailable', {
            description: 'The selected tables are not available at this time. Please choose different tables or time.'
          });
          return;
        }
      }

      // No conflict, proceed with save
      await saveReservation();

    } catch (error) {
      // Silent error handling - show user-friendly message only
      toast.error('Unable to save reservation', {
        description: 'Please check your details and try again'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const saveReservation = async () => {
    const reservationData = {
      ...formData,
      phone: normalizeUKPhone(formData.phone.trim()),
      table_numbers: selectedTables.length > 1 ? selectedTables : undefined,
      table_number: selectedTables.length === 1 ? selectedTables[0] : undefined,
      locked: isLocked,
      is_locked: isLocked,
      // Include metadata about found customer for downstream processing
      _foundCustomerId: foundCustomer?.id,
    };

    await onSave(reservationData);
  };

  const handleLockToggle = () => {
    // Capture current scroll position before state change
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
    setIsLocked(!isLocked);
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


  const handleDateClick = () => {
    setIsDateModalOpen(true);
  };

  const handleDateSelect = (selectedDate: string) => {
    setFormData({ ...formData, date: selectedDate });
  };

  const handleTimeClick = () => {
    setIsTimeModalOpen(true);
  };

  const handleTimeSelect = (selectedTime: string) => {
    setFormData({ ...formData, time: selectedTime });
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

  const handlePhoneChange = (value: string) => {
    setPhoneInput(value);
    
    // Update formData for validation
    setFormData(prev => ({ ...prev, phone: value }));
    
    // If user clears phone or changes it significantly, clear found customer
    if (!value || value.length < 5) {
      setFoundCustomer(null);
      setFormData(prev => ({
        ...prev,
        customer_name: '',
        email: ''
      }));
    }
    
    // Clear phone error when user types
    if (phoneError) {
      setPhoneError('');
    }
  };
  
  // Handle field focus for auto-clear behavior (walk-ins)
  const handleFieldFocus = (fieldName: string) => {
    if (isWalkIn && !touchedFields.has(fieldName)) {
      const defaultValues: Record<string, string> = {
        customer_name: 'Walk In',
        phone: '',
        email: ''
      };
      
      if (formData[fieldName as keyof typeof formData] === defaultValues[fieldName]) {
        setFormData({ ...formData, [fieldName]: '' });
      }
      setTouchedFields(prev => new Set(prev).add(fieldName));
    }
  };

  // Helper function to check if table groups can accommodate party size
  const canTableGroupsAccommodate = (partySize: number) => {
    return tableGroups.some(group => 
      group.max_combined_capacity && group.max_combined_capacity >= partySize
    );
  };

  // Auto-assignment capability check - removed space analysis dependency
  // Now relies on full optimization pipeline within autoAssignTables()

  // Check for auto-assignment capability
  useEffect(() => {
    if (formData.party_size && formData.date && formData.time && companyId) {
      const totalSeats = getTotalSeats();
      const hasInsufficientSeats = selectedTables.length > 0 && totalSeats < formData.party_size;
      const hasNoTablesSelected = selectedTables.length === 0;
      
      // Enable auto-assign if no tables selected or insufficient seats
      setCanAutoAssign(hasNoTablesSelected || hasInsufficientSeats);
    } else {
      setCanAutoAssign(false);
    }
  }, [
    formData.party_size, 
    formData.date, 
    formData.time, 
    companyId, 
    selectedTables.length
  ]);

  // Auto-trigger assignment when party size, date, or time changes (unless locked)
  useEffect(() => {
    // Skip if locked or missing required fields
    if (isLocked || !formData.party_size || !formData.date || !formData.time || !companyId) {
      return;
    }

    // Debounce to prevent excessive API calls while user is typing
    const timeoutId = setTimeout(() => {
      console.log(`🎯 Triggering auto-assignment: party_size=${formData.party_size}, date=${formData.date}, time=${formData.time}`);
      handleAutoAssign();
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [formData.party_size, formData.date, formData.time, isLocked, companyId]);

  // Clear insufficient selections when party size increases
  useEffect(() => {
    const previousPartySize = previousPartySizeRef.current;
    const currentPartySize = formData.party_size;
    
    // Skip if this is the initial load
    const isInitialLoad = previousPartySize === 2 && currentPartySize === 2;
    if (isInitialLoad) {
      previousPartySizeRef.current = currentPartySize;
      return;
    }
    
    // Proactively clear selections if they become insufficient
    if (selectedTables.length > 0) {
      const totalSeats = selectedTables.reduce((sum, tn) => {
        const table = operationalTables.find(t => t.table_number === tn);
        return sum + (table?.seats || 0);
      }, 0);
      
      if (totalSeats < currentPartySize) {
        console.log(`⚠️ Clearing insufficient selection: ${totalSeats} seats < ${currentPartySize} guests`);
        setSelectedTables([]);
      }
    }
    
    // Update previous party size
    previousPartySizeRef.current = currentPartySize;
  }, [formData.party_size]);

  const handleAutoAssign = async () => {
    if (!companyId || !formData.date || !formData.time || formData.party_size < 1) {
      return;
    }

    // Clear any insufficient selections before starting
    if (selectedTables.length > 0) {
      const totalSeats = selectedTables.reduce((sum, tn) => {
        const table = operationalTables.find(t => t.table_number === tn);
        return sum + (table?.seats || 0);
      }, 0);
      
      if (totalSeats < formData.party_size) {
        console.log(`🧹 Clearing insufficient selection at start of auto-assign: ${totalSeats} < ${formData.party_size}`);
        setSelectedTables([]);
      }
    }

    console.log(`🎯 Starting instant auto-assignment for ${formData.party_size} guests at ${formData.date} ${formData.time}`);
    setIsAutoAssigning(true);
    setHasFailedAutoAssign(false);

    try {
      console.log(`🎯 AUTO-ASSIGN DEBUG:`, {
        partySize: formData.party_size,
        date: formData.date,
        time: formData.time,
        operationalTableCount: operationalTables?.length,
        operationalTables: operationalTables?.map(t => ({
          number: t.table_number,
          seats: t.seats,
          accessible: t.accessibility_friendly,
          status: t.service_status
        })),
        totalSeats: operationalTables?.reduce((sum, t) => sum + (t.seats || 0), 0)
      });

      // Use full optimization pipeline with space-making and global rebalancing
      const result = await TableAssignmentOrchestrator.autoAssignTables(
        companyId,
        formData.party_size,
        formData.date,
        formData.time,
        null, // No existing reservation for new reservations
        true // Allow moving non-seated reservations to accommodate new bookings
      );

      console.log('[NewReservationModal] Orchestrator result:', result);

      if (result.success && result.tables.length > 0) {
        // VALIDATE assignment before accepting it
        const totalSeats = result.tables.reduce((sum, tn) => {
          const table = operationalTables.find(t => t.table_number === tn);
          return sum + (table?.seats || 0);
        }, 0);
        
        if (totalSeats >= formData.party_size) {
          console.log(`✅ Assignment validated: ${totalSeats} seats >= ${formData.party_size} guests`);
          setAutoAssignedTables(result.tables);
          setSelectedTables(result.tables);
          setUserAdjustedTables(false); // Reset since this is system-assigned
          setHasFailedAutoAssign(false);
          lastFailedSearchRef.current = ''; // Reset on success
          
          // Show feedback based on optimization level
          if (result.spaceMakingApplied || result.globalRebalancingApplied) {
            toast.success('Tables found after rearranging reservations');
          } else if (result.reason?.includes('optimization')) {
            toast.success('Tables automatically assigned');
          }
          // Otherwise silent success for direct assignments
        } else {
          console.error(`❌ Assignment REJECTED: ${totalSeats} seats < ${formData.party_size} guests`);
          setSelectedTables([]);
          setHasFailedAutoAssign(true);
        }
      } else {
        setHasFailedAutoAssign(true);
        setSelectedTables([]);
        
        // Create a unique key for this search to prevent duplicate toasts
        const searchKey = `${formData.party_size}-${formData.date}-${formData.time}`;
        
        // Only show error toast if this is a new failed search
        if (searchKey !== lastFailedSearchRef.current) {
          lastFailedSearchRef.current = searchKey;
          
          // Show detailed feedback
          if (result.spaceMakingApplied || result.globalRebalancingApplied) {
            toast.error('Unable to assign tables', {
              description: 'Tried rearranging existing reservations but no suitable configuration found'
            });
          } else if (result.reason && !result.reason.includes('alternative')) {
            toast.error('No suitable table configuration', {
              description: result.reason
            });
          }
        } else {
          console.log('⏭️ Skipping duplicate error toast for:', searchKey);
        }
      }
      
    } catch (error) {
      console.error('Auto-assign error:', error);
      setHasFailedAutoAssign(true);
      setSelectedTables([]);
    } finally {
      setIsAutoAssigning(false);
    }
  };

  /**
   * TIER 2: Handle alternative time search when no space available
   */
  const handleAlternativeTimeSearch = async (originalError: string) => {
    try {
      console.log(`🕐 TIER 2: Searching for alternative times for ${formData.party_size} guests`);
      
      const alternativeResult = await AlternativeTimeService.findBestAlternativeTime(
        companyId!,
        formData.date,
        formData.time,
        formData.party_size,
        formData.notes
      );

      if (alternativeResult.success && alternativeResult.suggestedTime) {
        const message = AlternativeTimeService.formatAlternativeTimeMessage(alternativeResult);
        
        setSuggestedAlternativeTime(alternativeResult.suggestedTime);
        setAlternativeTimeReason(message);
        setShowAlternativeTimeModal(true);
        
        console.log(`✅ ALTERNATIVE TIME FOUND: ${alternativeResult.suggestedTime} (${alternativeResult.confidence} confidence)`);
      }
    } catch (error) {
      console.error('Alternative time search failed:', error);
      toast.error(originalError, {
        description: 'Please try a different time or date'
      });
    }
  };

  /**
   * Handle user accepting the suggested alternative time
   */
  const handleAcceptAlternativeTime = () => {
    if (suggestedAlternativeTime) {
      setFormData({ ...formData, time: suggestedAlternativeTime });
      setShowAlternativeTimeModal(false);
      setSuggestedAlternativeTime(null);
      
      toast.success(`Time updated to ${suggestedAlternativeTime}`, {
        description: 'Please click Auto Assign again to find tables'
      });
    }
  };

  /**
   * Handle user declining the suggested alternative time
   */
  const handleDeclineAlternativeTime = () => {
    setShowAlternativeTimeModal(false);
    setSuggestedAlternativeTime(null);
    
    toast.info('Alternative time declined', {
      description: 'Try selecting tables manually or choose a different time'
    });
  };

  /**
   * Try to make space for a reservation by moving conflicting reservations
   */
  const tryMakeSpaceForReservation = async (
    targetTables: number[],
    date: string,
    time: string,
    forceMoveReservationIds?: string[] // IDs of reservations to force move
  ): Promise<boolean> => {
    if (!companyId) return false;
    
    try {
      console.log(`🎯 Making space on T${targetTables.join(',')} for ${formData.party_size}-guest reservation`);
      if (forceMoveReservationIds?.length) {
        console.log(`🔓 Override protection for ${forceMoveReservationIds.length} reservation(s)`);
      }
      
      const { data, error } = await supabase.functions.invoke('continuous-optimizer', {
        body: {
            companyId,
            mode: 'make_space_for_incoming',
            targetDate: date,
            targetTime: time,
            preferredTables: targetTables,
            targetPartySize: formData.party_size, // Party size for the NEW incoming reservation
            forceMoveReservationIds, // IDs to force move (overriding protection)
            overrideImminentProtection: !!forceMoveReservationIds?.length, // Enable override if forcing
            automated: false, // User-initiated
            allowImminentMoves: true, // Allow moving reservations close to start time
            allowStartedMoves: false // Don't move already-started reservations
        }
      });
      
      if (error) {
        console.error('Error making space:', error);
        toast.error('Unable to move reservations', {
          description: 'Could not automatically move existing reservations to make space.'
        });
        return false;
      }
      
      console.log('Make space result:', data);
      
      // Check if preferred tables were actually freed
      const freedTables = data?.freedPreferredTables === true;
      
      if (freedTables) {
        const movedDetails = data.movedReservations?.map((m: any) => 
          `T${m.fromTables?.join(',') || '?'} → T${m.toTables?.join(',') || '?'}`
        ).join(', ') || '';
        
        console.log(`✅ Successfully freed T${targetTables.join(',')} by moving ${data.movesCount} reservation(s): ${movedDetails}`);
        toast.success(`Table ${targetTables.join(', ')} is now available`, {
          description: `Moved ${data.movesCount} reservation(s) to make space for your booking.`
        });
        return true;
      } else {
        // Preferred tables couldn't be freed
        const movedCount = data?.movesCount || 0;
        const reason = data?.blockedReasons?.[0] || data?.reason || "No suitable alternative tables available";
        
        if (movedCount > 0) {
          console.warn(`⚠️ Moved ${movedCount} reservation(s) but T${targetTables.join(',')} still blocked: ${reason}`);
          toast.error(`Unable to free Table ${targetTables.join(', ')}`, {
            description: `Moved ${movedCount} reservation(s) but couldn't free the target table. Try a different table or time.`
          });
        } else {
          console.warn(`❌ Failed to make space: ${reason}`);
          toast.error('Unable to move the existing reservation', {
            description: reason === 'preferred_tables_still_blocked' 
              ? 'No alternative tables available to move the conflicting reservation.'
              : reason
          });
        }
        return false;
      }
    } catch (error) {
      console.error('Error in tryMakeSpaceForReservation:', error);
      return false;
    }
  };

  // Space-making optimization function removed - now handled automatically by autoAssignTables()

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent ref={scrollContainerRef} className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" disableAutoFocus={true} instantOpen={true}>
          <DialogHeader>
            <DialogTitle>{isWalkIn ? 'New Walk In' : 'Create New Reservation'}</DialogTitle>
          </DialogHeader>

          {defaults && (
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <div className="text-sm text-gray-600">
                <div className="font-medium">
                  {selectedTables.length > 1 
                    ? `Tables ${selectedTables.join(', ')}` 
                    : `Table ${defaults.tableNumber}`
                  }
                </div>
                <div>{formData.time} - {endTime} (2 hours)</div>
                <div>{new Date(defaults.date).toLocaleDateString()}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone Number - FIRST FIELD with customer lookup */}
            <div>
              <Label htmlFor="phone" className="flex items-center gap-2">
                Phone Number {!isWalkIn && '*'}
                {isSearchingCustomer && (
                  <Search className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
                {foundCustomer && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <UserCheck className="h-3 w-3" />
                    Customer found
                  </span>
                )}
                {!foundCustomer && phoneInput.length >= 10 && !isWalkIn && (
                  <span className="flex items-center gap-1 text-xs text-blue-600">
                    <UserPlus className="h-3 w-3" />
                    New customer
                  </span>
                )}
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phoneInput}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onFocus={() => handleFieldFocus('phone')}
                placeholder="07xxxxxxxxx"
                className={errors.phone ? 'border-red-500' : ''}
                disabled={isWalkIn}
              />
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
              )}
              {!isWalkIn && (
                <p className="text-xs text-muted-foreground mt-1">
                  Enter phone to search existing customers
                </p>
              )}
            </div>

            {/* Customer Status Badge - Show if customer found */}
            {foundCustomer && !isWalkIn && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                      Existing Customer Found
                      {foundCustomer.vip_status && (
                        <Crown className="h-3 w-3 text-yellow-500" />
                      )}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                      <strong>{foundCustomer.name}</strong>
                      {foundCustomer.email && ` • ${foundCustomer.email}`}
                    </p>
                    {foundCustomer.visits > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                        {foundCustomer.visits} previous visit{foundCustomer.visits !== 1 ? 's' : ''}
                        {foundCustomer.vip_status && ' • VIP Customer'}
                      </p>
                    )}
                    {foundCustomer.preferences?.length > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                        Preferences: {foundCustomer.preferences.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Customer Name and Party Size - SECOND ROW */}
            {foundCustomer && !isWalkIn ? (
              // When customer found: Only show Party Size (full width)
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
                        setFormData({...formData, party_size: '' as any});
                      } else {
                        setFormData({...formData, party_size: Math.max(1, parseInt(value) || 1)});
                      }
                    }}
                    onBlur={(e) => {
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
            ) : (
              // When new customer: Show Customer Name + Party Size grid
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer_name">Customer Name *</Label>
                  <Input
                    id="customer_name"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                    onFocus={() => handleFieldFocus('customer_name')}
                    placeholder="Enter customer name"
                    className={errors.customer_name ? 'border-red-500' : ''}
                  />
                  {errors.customer_name && (
                    <p className="text-red-500 text-xs mt-1">{errors.customer_name}</p>
                  )}
                </div>

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
                          setFormData({...formData, party_size: '' as any});
                        } else {
                          setFormData({...formData, party_size: Math.max(1, parseInt(value) || 1)});
                        }
                      }}
                      onBlur={(e) => {
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
              </div>
            )}

            {/* Email - Only show for new customers */}
            {!foundCustomer && !isWalkIn && (
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  onFocus={() => handleFieldFocus('email')}
                  placeholder="customer@email.com"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date *</Label>
                <div className="flex gap-2">
                  <div 
                    className={`relative cursor-pointer flex-1 ${errors.date ? 'border-red-500' : ''}`}
                    onClick={handleDateClick}
                  >
                    <Input
                      id="date"
                      type="text"
                      value={formData.date ? format(new Date(formData.date), 'dd/MM/yyyy') : ''}
                      readOnly
                      placeholder="Select date"
                      className={`cursor-pointer w-full ${errors.date ? 'border-red-500' : ''}`}
                    />
                    <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
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
                    onClick={handleTimeClick}
                    className={`flex-1 justify-start text-left font-normal ${
                      !formData.time && "text-muted-foreground"
                    } ${errors.time ? 'border-red-500' : ''}`}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {formData.time || 'Pick a time'}
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
            <div className="flex items-center justify-between mb-2">
            <Label>Select Tables *</Label>
            <button
              type="button"
              onClick={() => setShowAvailabilityView(!showAvailabilityView)}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              title={showAvailabilityView ? "Show auto-selected tables" : "Show table availability"}
            >
              {showAvailabilityView ? (
                <EyeOff className="h-4 w-4 text-gray-600" />
              ) : (
                <Eye className="h-4 w-4 text-gray-600" />
              )}
            </button>
          </div>
              
              <div className="mt-2 border rounded-md p-2 bg-white">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(90px,1fr))] gap-1">
                  {operationalTables.map((table) => {
                    const isSelected = selectedTables.includes(table.table_number);
                    const occupancyStatus = getTableOccupancyStatus(table.table_number);
                    const { isOccupied, canBeMoved } = occupancyStatus;
                    
                    const testSelection = [...selectedTables, table.table_number].sort((a, b) => a - b);
                    const validation = isValidTableCombination(testSelection, tableGroups as any);
                    const wouldBeInvalid = !isSelected && 
                      testSelection.length > 1 && 
                      !validation.valid;
                    
                    // Determine badge style based on state
                    let badgeClass = '';
                    let titleText = '';
                    let clickable = true;
                    
                    if (wouldBeInvalid && !showAvailabilityView) {
                      badgeClass = 'bg-white text-gray-400 border border-gray-200 opacity-50 cursor-not-allowed';
                      titleText = 'This table cannot be combined with your current selection (tables must be consecutive in the same group)';
                      clickable = false;
                    } else if (showAvailabilityView) {
                      // AVAILABILITY VIEW MODE - Display only status colors (no blue highlighting)
                      if (isOccupied && !canBeMoved) {
                        badgeClass = 'bg-white text-gray-700 border-2 border-red-400 cursor-not-allowed';
                        titleText = 'Occupied - Cannot be moved (seated or <10 min)';
                        clickable = false;
                      } else if (isOccupied && canBeMoved) {
                        badgeClass = 'bg-white text-gray-700 border-2 border-yellow-500 hover:bg-gray-50 cursor-pointer';
                        titleText = `${table.table_name || `Table ${table.table_number}`} (${table.seats} seats) - Occupied but can be moved`;
                      } else {
                        badgeClass = 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 cursor-pointer';
                        titleText = `${table.table_name || `Table ${table.table_number}`} (${table.seats} seats) - Available`;
                      }
                    } else if (isSelected) {
                      // Show selected tables in blue (only in auto-selected view)
                      badgeClass = 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer';
                      titleText = `${table.table_name || `Table ${table.table_number}`} (${table.seats} seats) - Click to deselect`;
                    } else {
                      // AUTO-SELECTED VIEW MODE - Show system-picked tables
                      const isAutoSelected = autoAssignedTables.includes(table.table_number);
                      
                      if (isAutoSelected) {
                        // Highlight tables that the system automatically picked
                        badgeClass = 'bg-blue-100 text-blue-900 border-2 border-blue-500 hover:bg-blue-200 cursor-pointer';
                        titleText = `${table.table_name || `Table ${table.table_number}`} (${table.seats} seats) - Auto-selected by system`;
                      } else if (isOccupied && canBeMoved) {
                        // Show movable tables in yellow
                        badgeClass = 'bg-white text-gray-700 border-2 border-yellow-500 hover:bg-gray-50 cursor-pointer';
                        titleText = `${table.table_name || `Table ${table.table_number}`} (${table.seats} seats) - Occupied but can be moved`;
                      } else if (isOccupied) {
                        // Show unmovable tables in red
                        badgeClass = 'bg-white text-gray-400 border-2 border-red-400 opacity-60 cursor-not-allowed';
                        titleText = 'Table occupied - Cannot be moved';
                        clickable = false;
                      } else {
                        // Available tables with subtle border
                        badgeClass = 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 cursor-pointer';
                        titleText = `${table.table_name || `Table ${table.table_number}`} (${table.seats} seats) - Available`;
                      }
                    }
                    
                    return (
                      <Badge
                        key={table.id}
                        variant={isSelected ? "default" : "outline"}
                        className={`px-2 py-1 text-xs font-medium transition-colors justify-center whitespace-nowrap ${badgeClass}`}
                        onClick={() => clickable && handleTableSelection(table.table_number)}
                        title={titleText}
                      >
                        {table.table_name || `T${table.table_number}`} ({table.seats})
                      </Badge>
                    );
                  })}
                </div>
              </div>
          {selectedTables.length > 0 && !showAvailabilityView && (
            <div className="mt-2 text-sm text-gray-600">
              Selected: {selectedTables.join(', ')} (Total: {totalSeats} seats)
              {formData.party_size > totalSeats && (
                <>
                  <span className="text-red-500 ml-2">
                    ⚠️ Not enough seats for {formData.party_size} guests
                  </span>
                  {(() => {
                    const suggestion = getIdealGroupSuggestion();
                    if (!suggestion) return null;
                    return (
                      <div className="mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTables(suggestion.tables)}
                        >
                          Select ideal group T{suggestion.tables.join(', ')} ({suggestion.totalSeats} seats)
                        </Button>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}
          {showAvailabilityView && (
            <div className="mt-2 text-xs text-gray-500 italic">
              👁️ Viewing availability - Click any table to override auto-assignment
            </div>
          )}
              {errors.tables && (
                <p className="text-red-500 text-xs mt-1">{errors.tables}</p>
              )}
            </div>

            <div>
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value: 'confirmed' | 'pending' | 'cancelled' | 'completed') =>
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
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
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
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Special requests, allergies, occasions, etc."
                rows={3}
              />
            </div>

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
              <Button type="submit" disabled={isValidating}>
                {isValidating ? 'Validating...' : 'Create Reservation'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manual move confirmation */}
      <Dialog open={!!pendingMove} onOpenChange={(open) => { if (!open) setPendingMove(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This table is currently reserved</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-2">
              Would you like to use this table anyway? We can move the existing reservation to another table.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm bg-blue-50 border border-blue-100 rounded-md p-3">
            <p className="text-blue-900 font-medium mb-2">Current reservation{pendingMove?.conflicts && pendingMove.conflicts.length > 1 ? 's' : ''}:</p>
            {pendingMove?.conflicts.map((res) => (
              <div key={res.id} className="flex items-center justify-between text-blue-800">
                <span>
                  {res.customer_name} • {res.party_size} {res.party_size === 1 ? 'guest' : 'guests'}
                </span>
                <span className="text-blue-600">{res.time}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" type="button" onClick={() => setPendingMove(null)}>Cancel</Button>
            <Button
              type="button"
              onClick={async () => {
                if (!pendingMove) return;
                setIsConfirmingMove(true);
                const ok = await attemptToMoveReservations(pendingMove.conflicts, [pendingMove.tableNumber]);
                setIsConfirmingMove(false);
                if (ok) {
                  const newSelection = [pendingMove.tableNumber].sort((a, b) => a - b);
                  setSelectedTables(newSelection);
                  toast.success(`Table ${pendingMove.tableNumber} is now available for your reservation`);
                  setPendingMove(null);
                } else {
                  // Error is already shown by tryMakeSpaceForReservation with detailed reason
                  setPendingMove(null);
                }
              }}
            >
              {isConfirmingMove ? 'Moving reservation...' : 'Yes, use this table'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
 
      <TimeSelectionModal
        isOpen={isTimeModalOpen}
        onClose={() => setIsTimeModalOpen(false)}
        onTimeSelect={handleTimeSelect}
        currentTime={formData.time}
      />
 
      <DatePickerModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onDateSelect={handleDateSelect}
        currentDate={formData.date}
      />
 
    </>
  );
};
