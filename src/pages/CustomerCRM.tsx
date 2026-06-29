import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Search, Filter, Edit, Trash2, FileText, CalendarPlus, StickyNote, Info, Clock, Plus, Minus, CalendarIcon, List, LayoutGrid, Eye, EyeOff, UserX, Timer, ShoppingBag, CalendarX, Ban, Crown, Shield, ChevronDown, ChevronUp, Loader2, AlertTriangle } from 'lucide-react';
import { SmartAutoAssignmentService } from '@/services/smartAutoAssignmentService';
import { format } from 'date-fns';
import { cn, getSafeLastVisit } from '@/lib/utils';
import { TimeSelectionModal } from '@/components/reservations/TimeSelectionModal';
import { formatCustomerName } from '@/utils/nameUtils';
import { ALLERGEN_LIST } from '@/utils/allergens';
import { getNextFifteenMinuteSlot } from '@/utils/timeUtils';
import { normalizeUKPhone, validateUKPhone, formatPhoneForDisplay, getPhoneValidationError } from '@/utils/phoneUtils';
import { useCustomerVisitCount } from '@/hooks/useCustomerVisitCount';
// Layout is now handled by MainLayout - no need to import
import { PrivateInfo } from '@/components/ui/private-info';
import { useCustomersQuery } from '@/hooks/useCustomersQuery';
import { useDeviceLiveLayer } from '@/hooks/useDeviceLiveLayer';
import { PageHeader } from '@/components/ui/page-header';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { fixFutureLastVisits } from '@/services/dataMaintenance/fixLastVisitBackfill';
import { offlineAwareUpdate, offlineAwareDelete } from '@/utils/offlineAwareSupabase';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  preferences?: string[];
  notes?: string;
  visits?: number;
  last_visit?: string;
  total_spent?: number;
  vip_status?: boolean;
  late_count?: number;
  no_show_count?: number;
  average_minutes_late?: number;
}

const CustomerCRM = () => {
  const { toast } = useToast();
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const deviceLive = useDeviceLiveLayer();
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [notesCustomer, setNotesCustomer] = useState<Customer | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);
  const [selectedCustomerForReservation, setSelectedCustomerForReservation] = useState<Customer | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [todayOnlyFilter, setTodayOnlyFilter] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');
  const [visibleCustomers, setVisibleCustomers] = useState<Set<string>>(new Set());
  const [todayReservations, setTodayReservations] = useState<{ customer_name: string; email?: string; phone?: string }[]>([]);
  const [isRepairRunning, setIsRepairRunning] = useState(false);
  const [repairCompleted, setRepairCompleted] = useState(false);
  const [highlightedCustomerId, setHighlightedCustomerId] = useState<string | null>(null);
  
  // Check for debug mode (via query param or env flag)
  const isDebugMode = new URLSearchParams(window.location.search).get('debug') === '1';

  // Auto-run repair utility once on mount to fix future last_visit dates
  React.useEffect(() => {
    if (companyId && !repairCompleted && !isRepairRunning) {
      const runRepair = async () => {
        try {
          const result = await fixFutureLastVisits(companyId);
          setRepairCompleted(true);
          
          if (result.customersFixed > 0 || result.customersCleared > 0) {
            console.log('✅ Auto-repaired last_visit dates:', {
              fixed: result.customersFixed,
              cleared: result.customersCleared
            });
            queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
          }
        } catch (error) {
          console.error('Auto-repair failed:', error);
        }
      };
      runRepair();
    }
  }, [companyId, repairCompleted, isRepairRunning, queryClient]);

  // Use the device-live aware customers query
  const { customers, loading } = useCustomersQuery();
  
  // Debug information
  console.log('👥 CustomerCRM Debug:', {
    deviceLive,
    customersCount: Array.isArray(customers) ? customers.length : 0,
    loading,
    companyId
  });

  // Client-side filtering when device live (data is already in cache)
  const displayCustomers = React.useMemo(() => {
    let filtered = customers as Customer[];

    // Apply search filter
    if (searchTerm) {
      filtered = (filtered as Customer[]).filter(customer => {
        return customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
               (customer.phone && customer.phone.includes(searchTerm));
      });
    }

    // Apply status filter
    filtered = (filtered as Customer[]).filter(customer => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'vip') return customer.vip_status;
      if (filterStatus === 'regular') return (customer.visits || 0) >= 5;
      if (filterStatus === 'new') {
        const lastVisit = customer.last_visit ? new Date(customer.last_visit) : null;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const isFirstTimeCustomer = (customer.visits || 0) <= 1;
        return lastVisit && lastVisit > thirtyDaysAgo && isFirstTimeCustomer;
      }
      
      if (filterStatus === 'inactive') {
        const lastVisit = customer.last_visit ? new Date(customer.last_visit) : null;
        const fortyFiveDaysAgo = new Date();
        fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
        return !lastVisit || lastVisit < fortyFiveDaysAgo;
      }
      return true;
    });

    // Apply today-only filter
    if (todayOnlyFilter && todayReservations.length > 0) {
      const todayCustomerNames = new Set(todayReservations.map(r => r.customer_name).filter(Boolean));
      const todayCustomerEmails = new Set(todayReservations.map(r => r.email).filter(Boolean));
      const todayCustomerPhones = new Set(todayReservations.map(r => r.phone).filter(Boolean));
      
      filtered = filtered.filter(customer => 
        todayCustomerNames.has(customer.name) || 
        (customer.email && todayCustomerEmails.has(customer.email)) ||
        (customer.phone && todayCustomerPhones.has(customer.phone))
      );
    } else if (todayOnlyFilter && todayReservations.length === 0) {
      // If today filter is on but no reservations today, return empty array
      filtered = [];
    }

    // Sort by VIP status, then activity, then alphabetically
    filtered = filtered.sort((a, b) => {
      const getPriority = (customer: Customer) => {
        if (customer.vip_status) return 1;
        const lastVisit = customer.last_visit ? new Date(customer.last_visit) : null;
        const fortyFiveDaysAgo = new Date();
        fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
        if (lastVisit && lastVisit >= fortyFiveDaysAgo) return 2;
        return 3;
      };
      
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);
      
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [customers, searchTerm, filterStatus, todayOnlyFilter, todayReservations]);

  const createCustomer = async (customerData: Omit<Customer, 'id' | 'company_id'>) => {
    if (!companyId) {
      toast({
        title: "Error",
        description: "No company found",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          ...customerData,
          company_id: companyId,
          visits: customerData.visits || 0
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer created successfully"
      });
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error",
        description: "Failed to create customer",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    if (!companyId) {
      toast({
        title: "Error",
        description: "No company found",
        variant: "destructive"
      });
      return;
    }

    try {
      // Fetch original customer data to get the old phone number
      const { data: originalCustomer, error: fetchError } = await supabase
        .from('customers')
        .select('phone, name, email')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

      if (fetchError) throw fetchError;

      // Update customer record
      const { data, error } = await offlineAwareUpdate('customers', id, updates);

      if (error) throw error;

      // Update all reservations with this customer's information
      if (originalCustomer?.phone) {
        const oldNormalizedPhone = normalizeUKPhone(originalCustomer.phone);
        
        if (oldNormalizedPhone) {
          // Build reservation updates object (only include fields that changed)
          const reservationUpdates: any = {};
          
          if (updates.name) {
            reservationUpdates.customer_name = updates.name;
          }
          if (updates.phone) {
            const newNormalizedPhone = normalizeUKPhone(updates.phone);
            if (newNormalizedPhone) {
              reservationUpdates.phone = newNormalizedPhone;
            }
          }
          if (updates.email !== undefined) {
            reservationUpdates.email = updates.email || '';
          }

          // Only update reservations if there are changes to cascade
          if (Object.keys(reservationUpdates).length > 0) {
            console.log(`📝 Updating reservations for customer ${id}:`, {
              oldPhone: oldNormalizedPhone,
              updates: reservationUpdates
            });

            // Fetch affected reservations first
            const { data: affectedReservations, error: fetchError } = await supabase
              .from('reservations')
              .select('id')
              .eq('company_id', companyId)
              .eq('phone', oldNormalizedPhone);

            if (fetchError) {
              console.error('Error fetching affected reservations:', fetchError);
            } else if (affectedReservations && affectedReservations.length > 0) {
              // Update each reservation using offlineAware
              for (const reservation of affectedReservations) {
                await offlineAwareUpdate('reservations', reservation.id, reservationUpdates);
              }
              console.log(`✅ Updated ${affectedReservations.length} reservation(s) with new customer info`);
            }

            if (fetchError) {
              console.error('Error updating reservations:', fetchError);
              // Don't throw - customer update succeeded, this is a secondary operation
            }
          }
        }
      }

      // Invalidate both customers and reservations caches
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
      queryClient.invalidateQueries({ queryKey: ['reservations', companyId] });

      toast({
        title: "Success",
        description: "Customer updated successfully"
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      toast({
        title: "Error",
        description: "Failed to update customer",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteCustomer = async (id: string) => {
    if (!companyId) {
      toast({
        title: "Error",
        description: "No company found",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await offlineAwareDelete('customers', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: "Failed to delete customer",
        variant: "destructive"
      });
      throw error;
    }
  };

  const toggleCustomerVisibility = (customerId: string) => {
    setVisibleCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  const handleCustomerClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailsDialogOpen(true);
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    if (isSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchOpen]);

  // Fetch today's reservations when today filter is enabled
  React.useEffect(() => {
    const fetchTodayReservations = async () => {
      if (!todayOnlyFilter || !companyId) {
        setTodayReservations([]);
        return;
      }

      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const { data, error } = await supabase
          .from('reservations')
          .select('customer_name, email, phone')
          .eq('date', today)
          .eq('company_id', companyId);

        if (error) {
          console.error('Error fetching today\'s reservations:', error);
          setTodayReservations([]);
        } else {
          setTodayReservations(data || []);
        }
      } catch (error) {
        console.error('Error in fetchTodayReservations:', error);
        setTodayReservations([]);
      }
    };

    fetchTodayReservations();
  }, [todayOnlyFilter, companyId]);

  const handleSaveCustomer = async (customer: Customer) => {
    const formattedCustomer = {
      ...customer,
      name: formatCustomerName(customer.name)
    };

    try {
      if (editingCustomer) {
        await updateCustomer(customer.id, formattedCustomer);
      } else {
        // Remove id from customer data when creating new customer
        const { id, ...customerDataWithoutId } = formattedCustomer;
        await createCustomer(customerDataWithoutId);
      }
      
      setIsDialogOpen(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      await deleteCustomer(id);
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const handleNotesAction = (customer: Customer) => {
    setNotesCustomer(customer);
    setIsNotesDialogOpen(true);
  };

  const handleReservationAction = (customer: Customer) => {
    setSelectedCustomerForReservation(customer);
    setIsReservationDialogOpen(true);
  };

  const handleSaveNotes = async (notes: string) => {
    if (!notesCustomer) return;

    try {
      await updateCustomer(notesCustomer.id, { notes });
      
      // Optimistically update the cache with new notes
      queryClient.setQueryData(['customers', companyId], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((customer: Customer) => 
          customer.id === notesCustomer.id 
            ? { ...customer, notes } 
            : customer
        );
      });
      
      // Update the notesCustomer state to reflect new data
      setNotesCustomer(prev => prev ? { ...prev, notes } : null);
      
      setIsNotesDialogOpen(false);
      setNotesCustomer(null);
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  const handleCreateReservation = async (reservationData: any) => {
    if (!selectedCustomerForReservation) return;

    if (!companyId) {
      toast({ 
        title: "Error", 
        description: "No company found. Please try logging in again.",
        variant: "destructive" 
      });
      return;
    }

    try {
      const reservationDate = reservationData.date instanceof Date 
        ? reservationData.date.toISOString().split('T')[0]
        : reservationData.date;

      // Normalize time format to HH:mm:ss
      const normalizedTime = reservationData.time.length === 5 
        ? `${reservationData.time}:00` 
        : reservationData.time;

      // Calculate start_time and end_time (90-minute default duration)
      const startTime = normalizedTime;
      const [hours, minutes] = normalizedTime.split(':').map(Number);
      const endHours = Math.floor((hours * 60 + minutes + 90) / 60);
      const endMinutes = (hours * 60 + minutes + 90) % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:00`;

      // Get current user for created_by field
      const { data: userData } = await supabase.auth.getUser();
      const { data: publicUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData.user?.id)
        .single();

      // Use Smart Assignment Service to find best table
      const assignmentResult = await SmartAutoAssignmentService.assignBestTable(
        companyId,
        reservationDate,
        normalizedTime,
        reservationData.partySize,
        reservationData.notes
      );

      if (!assignmentResult.success) {
        toast({
          title: "No tables available",
          description: assignmentResult.message || "Unable to find suitable table. Try a different time.",
          variant: "destructive"
        });
        return;
      }

      // Normalize phone number to UK format (11 digits starting with 0)
      const normalizedPhone = selectedCustomerForReservation.phone 
        ? normalizeUKPhone(selectedCustomerForReservation.phone) 
        : '';

      // Create reservation with all required fields
      const { data, error } = await supabase
        .from('reservations')
        .insert({
          customer_name: formatCustomerName(selectedCustomerForReservation.name),
          email: selectedCustomerForReservation.email || null,
          phone: normalizedPhone || null,
          party_size: reservationData.partySize,
          date: reservationDate,
          time: normalizedTime,
          start_time: startTime,
          end_time: endTime,
          notes: reservationData.notes || '',
          status: 'confirmed',
          reservation_type: 'standard',
          company_id: companyId,
          created_by: publicUser?.id || null,
          locked: false,
          has_allergens: reservationData.has_allergens || false,
          allergens: reservationData.allergens || [],
          table_number: assignmentResult.assignedTable || null,
          table_numbers: assignmentResult.assignedTables || null
        })
        .select()
        .single();

      if (error) throw error;
      
      const tableInfo = assignmentResult.assignedTables?.length > 1 
        ? `Tables ${assignmentResult.assignedTables.join(', ')}`
        : `Table ${assignmentResult.assignedTable}`;
      
      const strategyInfo = assignmentResult.assignmentStrategy ? ` (${assignmentResult.assignmentStrategy})` : '';
      
      toast({ 
        title: "Reservation created successfully",
        description: `Assigned to ${tableInfo}${strategyInfo}`
      });
      
      setIsReservationDialogOpen(false);
      setSelectedCustomerForReservation(null);
    } catch (error: any) {
      console.error('Error creating reservation:', error);
      const errorMessage = error?.message || error?.details || error?.hint || 'Unknown error occurred';
      toast({ 
        title: "Error creating reservation", 
        description: errorMessage,
        variant: "destructive" 
      });
    }
  };

  const scrollToAndHighlightCustomer = (customerId: string) => {
    // Close the dialog
    setIsDialogOpen(false);
    setEditingCustomer(null);
    
    // Set highlighted customer
    setHighlightedCustomerId(customerId);
    
    // Ensure customer is visible (eye open)
    setVisibleCustomers(prev => new Set([...prev, customerId]));
    
    // Scroll to the customer card after a short delay for dialog to close
    setTimeout(() => {
      const element = document.getElementById(`customer-card-${customerId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    
    // Remove highlight after 2 seconds
    setTimeout(() => {
      setHighlightedCustomerId(null);
    }, 2100);
  };

  const getStatusBadge = (customer: Customer) => {
    if (customer.vip_status) {
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">VIP</Badge>;
    }
    
    const safeLastVisit = getSafeLastVisit(customer.last_visit);
    const lastVisit = safeLastVisit ? new Date(safeLastVisit) : null;
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
    
    if (!lastVisit || lastVisit < fortyFiveDaysAgo) {
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">Inactive</Badge>;
    }
    
    return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>;
  };

  const handleRepairLastVisits = async () => {
    if (!companyId || isRepairRunning) return;

    setIsRepairRunning(true);
    toast({
      title: "Starting repair...",
      description: "Checking for customers with future last_visit dates"
    });

    try {
      const result = await fixFutureLastVisits(companyId);
      
      if (result.success) {
        toast({
          title: "Repair completed",
          description: `Fixed ${result.customersFixed} customers, cleared ${result.customersCleared} customers`
        });
        
        // Refresh customer data
        queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
      } else {
        toast({
          title: "Repair completed with errors",
          description: `Fixed ${result.customersFixed}, cleared ${result.customersCleared}. ${result.errors.length} errors occurred.`,
          variant: "destructive"
        });
        console.error('Repair errors:', result.errors);
      }
    } catch (error: any) {
      toast({
        title: "Repair failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRepairRunning(false);
    }
  };

  const getFilterLabel = () => {
    switch (filterStatus) {
      case 'all': return 'All Customers';
      case 'vip': return 'VIP Customers';
      case 'regular': return 'Regular Customers';
      case 'new': return 'New Customers';
      
      case 'inactive': return 'Inactive';
      default: return 'All Customers';
    }
  };

  // Always render page shell - show skeleton loading for data sections

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PageHeader 
          title="Customer CRM" 
          subtitle="Manage customer relationships and preferences"
        >
          <div className="flex items-center gap-3">
            {/* Debug: Repair Last Visit Button */}
            {isDebugMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRepairLastVisits}
                    disabled={isRepairRunning}
                    className="text-orange-600 border-orange-300"
                  >
                    <Shield className="h-4 w-4 mr-1" />
                    {isRepairRunning ? 'Repairing...' : 'Repair Last Visit'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Fix customers with future last_visit dates</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cards')}
                className="px-3"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Cards
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="px-3"
              >
                <List className="h-4 w-4 mr-1" />
                List
              </Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingCustomer(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingCustomer(null)}>Add Customer</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <CustomerForm
                  customer={editingCustomer}
                  onSave={handleSaveCustomer}
                  onCancel={() => {
                    setIsDialogOpen(false);
                    setEditingCustomer(null);
                  }}
                  onNavigateToCustomer={scrollToAndHighlightCustomer}
                />
              </DialogContent>
            </Dialog>
          </div>
        </PageHeader>

        <div className="flex items-center gap-4">
          <div className="relative" ref={searchRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
            </Button>
            
            {isSearchOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 z-50">
                <Input
                  placeholder="Search customers by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white shadow-lg border-2"
                  autoFocus
                />
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {getFilterLabel()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => setFilterStatus('all')}>
                All Customers
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('vip')}>
                VIP Customers
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('regular')}>
                Regular Customers
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('new')}>
                New Customers
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('inactive')}>
                Inactive Customers
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={todayOnlyFilter ? "default" : "outline"}
                size="sm"
                onClick={() => setTodayOnlyFilter(!todayOnlyFilter)}
                className={`flex items-center gap-2 ${
                  todayOnlyFilter 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{todayOnlyFilter ? 'Show all customers' : 'Show today\'s reservation customers only'}</p>
            </TooltipContent>
          </Tooltip>

          <div className="text-sm text-gray-500">
            {(displayCustomers as Customer[]).length} customer{(displayCustomers as Customer[]).length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Customer Display */}
        {(loading && !deviceLive) ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : viewMode === 'list' ? (
          <CustomerListView 
            customers={displayCustomers as Customer[]}
            visibleCustomers={visibleCustomers}
            onEdit={(customer) => {
              setEditingCustomer(customer);
              setIsDialogOpen(true);
            }}
            onDelete={handleDeleteCustomer}
            onNotes={handleNotesAction}
            onReservation={handleReservationAction}
            onToggleVisibility={toggleCustomerVisibility}
            getStatusBadge={getStatusBadge}
            onCustomerClick={handleCustomerClick}
          />
        ) : (
          <CustomerCardView 
            customers={displayCustomers as Customer[]}
            visibleCustomers={visibleCustomers}
            onEdit={(customer) => {
              setEditingCustomer(customer);
              setIsDialogOpen(true);
            }}
            onDelete={handleDeleteCustomer}
            onNotes={handleNotesAction}
            onReservation={handleReservationAction}
            onToggleVisibility={toggleCustomerVisibility}
            getStatusBadge={getStatusBadge}
            highlightedCustomerId={highlightedCustomerId}
            onCustomerClick={handleCustomerClick}
          />
        )}

        {/* Dialogs */}
        <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
          <DialogContent
            onInteractOutside={() => {
              setIsNotesDialogOpen(false);
              setNotesCustomer(null);
            }}
            onEscapeKeyDown={() => {
              setIsNotesDialogOpen(false);
              setNotesCustomer(null);
            }}
          >
            <DialogHeader>
              <DialogTitle>Customer Notes</DialogTitle>
              <DialogDescription>
                Add or update notes for {notesCustomer?.name}
              </DialogDescription>
            </DialogHeader>
            <NotesForm
              initialNotes={notesCustomer?.notes || ''}
              onSave={handleSaveNotes}
              onCancel={() => {
                setIsNotesDialogOpen(false);
                setNotesCustomer(null);
              }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={isReservationDialogOpen} onOpenChange={setIsReservationDialogOpen}>
          <DialogContent
            className="w-[95vw] max-w-sm sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden"
            onInteractOutside={() => {
              setIsReservationDialogOpen(false);
              setSelectedCustomerForReservation(null);
            }}
            onEscapeKeyDown={() => {
              setIsReservationDialogOpen(false);
              setSelectedCustomerForReservation(null);
            }}
          >
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Quick Reservation</DialogTitle>
              <DialogDescription>
                Create a reservation for {selectedCustomerForReservation?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 px-1">
              <QuickReservationForm
                customer={selectedCustomerForReservation}
                onSave={handleCreateReservation}
                onCancel={() => {
                  setIsReservationDialogOpen(false);
                  setSelectedCustomerForReservation(null);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <CustomerDetailsModal
              customer={selectedCustomer}
              onClose={() => {
                setIsDetailsDialogOpen(false);
                setSelectedCustomer(null);
              }}
              getStatusBadge={getStatusBadge}
            />
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export interface CustomerFormProps {
  customer: Customer | null;
  onSave: (customer: Customer) => void;
  onCancel: () => void;
  onNavigateToCustomer?: (customerId: string) => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({ customer, onSave, onCancel, onNavigateToCustomer }) => {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState<Customer>({
    id: customer?.id || '',
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    preferences: customer?.preferences || [],
    notes: customer?.notes || '',
    visits: customer?.visits || 0,
    last_visit: customer?.last_visit || '',
    total_spent: customer?.total_spent || 0,
    vip_status: customer?.vip_status || false,
  });

  const [newPreference, setNewPreference] = useState('');
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [existingCustomer, setExistingCustomer] = useState<{id: string, name: string} | null>(null);

  // Debounced duplicate check when phone changes
  useEffect(() => {
    const checkPhone = async () => {
      // Early return if no companyId
      if (!companyId) {
        console.log('⚠️ No companyId available for phone duplicate check');
        setExistingCustomer(null);
        return;
      }

      const normalizedPhone = normalizeUKPhone(formData.phone);
      if (!normalizedPhone || normalizedPhone.length < 10) {
        setExistingCustomer(null);
        return;
      }
      
      // Skip check if editing the same customer
      if (customer?.phone === normalizedPhone) {
        setExistingCustomer(null);
        return;
      }
      
      setIsCheckingPhone(true);
      console.log('🔍 Checking for duplicate phone:', normalizedPhone, 'companyId:', companyId);
      
      // Use maybeSingle() instead of single() to handle 0 or 1 results gracefully
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('phone', normalizedPhone)
        .maybeSingle();
      
      if (error) {
        console.error('❌ Phone duplicate check failed:', error);
        setExistingCustomer(null);
      } else {
        console.log('✅ Phone check result:', data);
        setExistingCustomer(data);
      }
      setIsCheckingPhone(false);
    };
    
    const timeout = setTimeout(checkPhone, 500);
    return () => clearTimeout(timeout);
  }, [formData.phone, customer?.phone, companyId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone is provided
    if (!formData.phone.trim()) {
      toast({
        title: "Phone required",
        description: "Phone number is required to add a customer",
        variant: "destructive"
      });
      return;
    }
    
    // Validate UK phone format
    if (!validateUKPhone(formData.phone.trim())) {
      toast({
        title: "Invalid phone",
        description: getPhoneValidationError(formData.phone.trim()),
        variant: "destructive"
      });
      return;
    }
    
    // Prevent save if duplicate exists
    if (existingCustomer) {
      toast({
        title: "Duplicate customer",
        description: `A customer with this phone already exists: ${existingCustomer.name}`,
        variant: "destructive"
      });
      return;
    }
    
    // Normalize phone before saving
    const normalizedData = {
      ...formData,
      phone: normalizeUKPhone(formData.phone.trim())
    };
    
    onSave(normalizedData);
  };

  const addPreference = () => {
    if (newPreference.trim() && !formData.preferences?.includes(newPreference.trim())) {
      setFormData(prev => ({
        ...prev,
        preferences: [...(prev.preferences || []), newPreference.trim()]
      }));
      setNewPreference('');
    }
  };

  const removePreference = (pref: string) => {
    setFormData(prev => ({
      ...prev,
      preferences: prev.preferences?.filter(p => p !== pref) || []
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{customer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
      </DialogHeader>
      
      {/* Phone - Now first and required */}
      <div>
        <Label htmlFor="phone">Phone *</Label>
        <div className="relative">
          <Input
            id="phone"
            value={formatPhoneForDisplay(formData.phone)}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="07xxx xxx xxx"
            required
          />
          {isCheckingPhone && (
            <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-3 text-muted-foreground" />
          )}
        </div>
        {existingCustomer && (
          <div className="flex items-center gap-2 text-amber-600 text-sm mt-1">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Customer already exists:{' '}
              <button
                type="button"
                onClick={() => onNavigateToCustomer?.(existingCustomer.id)}
                className="font-semibold underline hover:text-amber-700 cursor-pointer"
              >
                {existingCustomer.name}
              </button>
            </span>
          </div>
        )}
      </div>
      
      {/* Name and Email side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          />
        </div>
      </div>
      
      <div>
        <Label>Preferences</Label>
        <div className="flex gap-2 mb-2">
          <Input
            placeholder="Add preference..."
            value={newPreference}
            onChange={(e) => setNewPreference(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPreference())}
          />
          <Button type="button" onClick={addPreference} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {formData.preferences?.map((pref, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1">
              {pref}
              <Button
                type="button"
                onClick={() => removePreference(pref)}
                size="sm"
                variant="ghost"
                className="h-auto p-0 w-4 h-4 hover:bg-red-100"
              >
                <Minus className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="vip_status"
          checked={formData.vip_status}
          onChange={(e) => setFormData(prev => ({ ...prev, vip_status: e.target.checked }))}
        />
        <Label htmlFor="vip_status">VIP Status</Label>
      </div>
      
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
        />
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!!existingCustomer || isCheckingPhone}>
          {customer ? 'Update' : 'Add'} Customer
        </Button>
      </div>
    </form>
  );
};

interface NotesFormProps {
  initialNotes: string;
  onSave: (notes: string) => void;
  onCancel: () => void;
}

const NotesForm: React.FC<NotesFormProps> = ({ initialNotes, onSave, onCancel }) => {
  const [notes, setNotes] = useState(initialNotes);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(notes);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={5}
        placeholder="Add notes about this customer..."
      />
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save Notes</Button>
      </div>
    </form>
  );
};

interface QuickReservationFormProps {
  customer: Customer | null;
  onSave: (data: any) => void;
  onCancel: () => void;
}

const QuickReservationForm: React.FC<QuickReservationFormProps> = ({ customer, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    partySize: 2,
    date: new Date().toISOString().split('T')[0],
    time: '19:00',
    notes: '',
    has_allergens: false,
    allergens: [] as string[]
  });

  const [showTimeModal, setShowTimeModal] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="partySize">Party Size</Label>
          <Input
            id="partySize"
            type="number"
            min="1"
            max="20"
            value={formData.partySize}
            onChange={(e) => setFormData(prev => ({ ...prev, partySize: parseInt(e.target.value) || 1 }))}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            required
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="time">Time</Label>
        <div className="flex gap-2">
          <Button 
            type="button"
            variant="outline"
            onClick={() => setShowTimeModal(true)}
            className="flex-1 justify-start text-left font-normal"
          >
            <Clock className="mr-2 h-4 w-4" />
            {formData.time}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const nextSlot = getNextFifteenMinuteSlot();
              setFormData(prev => ({ ...prev, time: nextSlot }));
            }}
            className="px-3 text-xs"
          >
            Now
          </Button>
        </div>
      </div>
      
      {/* Allergen Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="has_allergens">Any Allergies?</Label>
          <Switch
            id="has_allergens"
            checked={formData.has_allergens}
            onCheckedChange={(checked) => {
              setFormData(prev => ({
                ...prev,
                has_allergens: checked,
                allergens: checked ? prev.allergens : []
              }));
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
                      setFormData(prev => ({...prev, allergens: newAllergens}));
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
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
        />
      </div>
      
      <div className="flex justify-end space-x-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Create Reservation</Button>
      </div>

      {showTimeModal && (
        <TimeSelectionModal
          isOpen={showTimeModal}
          onClose={() => setShowTimeModal(false)}
          onTimeSelect={(time) => {
            setFormData(prev => ({ ...prev, time }));
            setShowTimeModal(false);
          }}
          currentTime={formData.time}
        />
      )}
    </form>
  );
};

interface CustomerListViewProps {
  customers: Customer[];
  visibleCustomers: Set<string>;
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => void;
  onNotes: (customer: Customer) => void;
  onReservation: (customer: Customer) => void;
  onToggleVisibility: (id: string) => void;
  getStatusBadge: (customer: Customer) => React.ReactNode;
  onCustomerClick: (customer: Customer) => void;
}

const CustomerListView: React.FC<CustomerListViewProps> = ({
  customers,
  visibleCustomers,
  onEdit,
  onDelete,
  onNotes,
  onReservation,
  onToggleVisibility,
  getStatusBadge,
  onCustomerClick
}) => {
  if (customers.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-gray-500 text-lg">No customers found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {customers.map((customer) => (
        <Card 
          key={customer.id} 
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onCustomerClick(customer)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(customer.id);
                  }}
                  className="p-1 h-8 w-8"
                >
                  {visibleCustomers.has(customer.id) ? 
                    <Eye className="h-4 w-4" /> : 
                    <EyeOff className="h-4 w-4" />
                  }
                </Button>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{customer.name}</h3>
                    {getStatusBadge(customer)}
                  </div>
                  
                  {visibleCustomers.has(customer.id) && (
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                       <div>
                         <PrivateInfo type="email" value={customer.email || 'No email'} isVisible={true} />
                       </div>
                       <div>
                         <PrivateInfo type="phone" value={customer.phone || 'No phone'} isVisible={true} />
                       </div>
                       <div>Visits: {customer.visits || 0}</div>
                        <div style={{ opacity: 0 }}>Spent: £{(customer.total_spent || 0).toFixed(2)}</div>
                       {(() => {
                         const safeLastVisit = getSafeLastVisit(customer.last_visit);
                         return safeLastVisit && (
                           <div>Last visit: {format(new Date(safeLastVisit), 'MMM dd, yyyy')}</div>
                         );
                       })()}
                      {customer.preferences && customer.preferences.length > 0 && (
                        <div className="col-span-2">
                          <div className="flex flex-wrap gap-1 mt-1">
                            {customer.preferences.map((pref, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {pref}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNotes(customer)}
                      className="h-8 w-8 p-0"
                    >
                      <StickyNote className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Manage notes</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReservation(customer)}
                      className="h-8 w-8 p-0"
                    >
                      <CalendarPlus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Quick reservation</p>
                  </TooltipContent>
                </Tooltip>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      ⋮
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(customer)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDelete(customer.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

interface CustomerCardViewProps extends CustomerListViewProps {
  highlightedCustomerId?: string | null;
}

const CustomerCardView: React.FC<CustomerCardViewProps> = ({
  customers,
  visibleCustomers,
  onEdit,
  onDelete,
  onNotes,
  onReservation,
  onToggleVisibility,
  getStatusBadge,
  onCustomerClick,
  highlightedCustomerId
}) => {
  if (customers.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-gray-500 text-lg">No customers found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {customers.map((customer) => (
        <Card 
          key={customer.id}
          id={`customer-card-${customer.id}`}
          className={cn(
            "hover:shadow-lg transition-shadow cursor-pointer",
            highlightedCustomerId === customer.id && "ring-2 ring-orange-400 ring-offset-2 transition-all"
          )}
          onClick={() => onCustomerClick(customer)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleVisibility(customer.id)}
                  className="p-1 h-6 w-6"
                >
                  {visibleCustomers.has(customer.id) ? 
                    <Eye className="h-3 w-3" /> : 
                    <EyeOff className="h-3 w-3" />
                  }
                </Button>
                {getStatusBadge(customer)}
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <span className="sr-only">Open menu</span>
                    ⋮
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(customer)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete(customer.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <h3 className="font-semibold mb-2">{customer.name}</h3>
            
            {visibleCustomers.has(customer.id) && (
              <div className="space-y-2 text-sm text-gray-600 mb-3">
                <PrivateInfo type="email" value={customer.email || 'No email'} isVisible={true} />
                <PrivateInfo type="phone" value={customer.phone || 'No phone'} isVisible={true} />
                <div>Visits: {customer.visits || 0}</div>
                <div style={{ opacity: 0 }}>Spent: £{(customer.total_spent || 0).toFixed(2)}</div>
                {(() => {
                  const safeLastVisit = getSafeLastVisit(customer.last_visit);
                  return safeLastVisit && (
                    <div>Last visit: {format(new Date(safeLastVisit), 'MMM dd')}</div>
                  );
                })()}
                {customer.preferences && customer.preferences.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {customer.preferences.slice(0, 2).map((pref, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {pref}
                      </Badge>
                    ))}
                    {customer.preferences.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{customer.preferences.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-center space-x-1" onClick={(e) => e.stopPropagation()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNotes(customer)}
                    className="h-8 w-8 p-0"
                  >
                    <StickyNote className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manage notes</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReservation(customer)}
                    className="h-8 w-8 p-0"
                  >
                    <CalendarPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Quick reservation</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

interface CustomerOrderHistoryProps {
  customerId: string;
  companyId: string;
}

const CustomerOrderHistory: React.FC<CustomerOrderHistoryProps> = ({ customerId, companyId }) => {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          created_at,
          total_amount,
          amount_paid,
          payment_status,
          order_items(quantity)
        `)
        .eq('customer_id', customerId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading orders...</div>;
  }

  if (!orders || orders.length === 0) {
    return <div className="text-sm text-muted-foreground">No orders yet</div>;
  }

  const totalSpent = orders.reduce((sum, order) => sum + (order.amount_paid || 0), 0);
  const totalOrders = orders.length;

  return (
    <div className="space-y-3">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Total Spent</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">£{totalSpent.toFixed(2)}</p>
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <p className="text-xs text-blue-600 dark:text-blue-400">Total Orders</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{totalOrders}</p>
        </div>
      </div>

      {/* Order List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        <p className="text-sm font-medium">Recent Orders</p>
        {orders.map((order) => (
          <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Order #{order.order_number || 'N/A'}</span>
                <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                  {order.payment_status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
              </p>
              <p className="text-xs text-muted-foreground">
                {order.order_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0} items
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium">£{(order.amount_paid || 0).toFixed(2)}</p>
              {order.amount_paid < order.total_amount && (
                <p className="text-xs text-orange-600">
                  (of £{order.total_amount.toFixed(2)})
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface CustomerDetailsModalProps {
  customer: Customer | null;
  onClose: () => void;
  getStatusBadge: (customer: Customer) => React.ReactNode;
}

const CustomerDetailsModal: React.FC<CustomerDetailsModalProps> = ({ customer, onClose, getStatusBadge }) => {
  const { toast } = useToast();
  const { companyId } = useAuth();
  const [isVisitHistoryExpanded, setIsVisitHistoryExpanded] = useState(false);
  const [customerVisits, setCustomerVisits] = useState<Array<{ date: string; party_size: number }>>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [completedVisitsCount, setCompletedVisitsCount] = useState<number>(0);
  const [lastVisitFromQuery, setLastVisitFromQuery] = useState<string | null>(null);
  
  // Fetch visit count and last visit date from database on mount to ensure consistency
  useEffect(() => {
    const fetchVisitCount = async () => {
      if (!companyId || !customer.phone) return;
      try {
        const normalized = normalizeUKPhone(customer.phone);
        const phoneVariants = [
          customer.phone,
          normalized,
          normalized.replace(/^0/, '44'),
          '+' + normalized.replace(/^0/, '44')
        ].filter((p, index, self) => p && p.length >= 10 && self.indexOf(p) === index);

        // Get count and most recent visit date
        const { data: recentVisit, error: visitError } = await supabase
          .from('reservations')
          .select('date')
          .eq('company_id', companyId)
          .in('phone', phoneVariants)
          .eq('status', 'completed')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!visitError && recentVisit) {
          setLastVisitFromQuery(recentVisit.date);
        } else {
          setLastVisitFromQuery(null);
        }

        const { count, error } = await supabase
          .from('reservations')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .in('phone', phoneVariants)
          .eq('status', 'completed');
        
        if (!error && count !== null) {
          setCompletedVisitsCount(count);
        }
      } catch (error) {
        console.error('Error fetching visit count:', error);
      }
    };
    fetchVisitCount();
  }, [customer.phone, companyId]);
  
  // Late Arrivals state
  const [isLateArrivalsExpanded, setIsLateArrivalsExpanded] = useState(false);
  const [lateArrivals, setLateArrivals] = useState<Array<{ reservation_date: string; party_size: number; minutes_late: number | null }>>([]);
  const [loadingLateArrivals, setLoadingLateArrivals] = useState(false);

  // No Shows state
  const [isNoShowsExpanded, setIsNoShowsExpanded] = useState(false);
  const [noShows, setNoShows] = useState<Array<{ reservation_date: string; party_size: number }>>([]);
  const [loadingNoShows, setLoadingNoShows] = useState(false);

  // Total Spent state
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [loadingTotalSpent, setLoadingTotalSpent] = useState(false);

  if (!customer) return null;

  // Fetch total spent from orders
  const fetchTotalSpent = async () => {
    if (!companyId || !customer.id) return;
    setLoadingTotalSpent(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('amount_paid')
        .eq('customer_id', customer.id)
        .eq('company_id', companyId);
      
      if (!error && data) {
        const total = data.reduce((sum, order) => sum + (order.amount_paid || 0), 0);
        setTotalSpent(total);
      }
    } catch (error) {
      console.error('Error fetching total spent:', error);
    } finally {
      setLoadingTotalSpent(false);
    }
  };

  useEffect(() => {
    fetchTotalSpent();
  }, [customer.id, companyId]);

  const fetchCustomerVisits = async (customerPhone: string) => {
    if (!companyId) return;
    setLoadingVisits(true);
    try {
      // Normalize phone and create variants to handle different formats
      const normalized = normalizeUKPhone(customerPhone);
      const phoneVariants = [
        customerPhone,
        normalized,
        normalized.replace(/^0/, '44'),
        '+' + normalized.replace(/^0/, '44')
      ].filter((p, index, self) => p && p.length >= 10 && self.indexOf(p) === index);

      const { data, error } = await supabase
        .from('reservations')
        .select('date, party_size')
        .eq('company_id', companyId)
        .in('phone', phoneVariants)
        .eq('status', 'completed')
        .order('date', { ascending: false});
      
      if (!error && data) {
        setCustomerVisits(data);
        // Update count and last visit to match the fetched visits
        setCompletedVisitsCount(data.length);
        if (data.length > 0) {
          setLastVisitFromQuery(data[0].date);
        }
      }
    } catch (error) {
      console.error('Error fetching visits:', error);
    } finally {
      setLoadingVisits(false);
    }
  };

  const handleToggleVisitHistory = () => {
    if (!isVisitHistoryExpanded && customerVisits.length === 0) {
      fetchCustomerVisits(customer.phone || '');
    }
    setIsVisitHistoryExpanded(!isVisitHistoryExpanded);
  };

  const fetchLateArrivals = async (customerPhone: string) => {
    if (!companyId) return;
    setLoadingLateArrivals(true);
    try {
      const { data, error } = await supabase
        .from('customer_reservation_history')
        .select('reservation_date, party_size, minutes_late')
        .eq('company_id', companyId)
        .eq('customer_phone', customerPhone)
        .in('event_type', ['marked_late', 'late_arrival'])
        .order('reservation_date', { ascending: false });
      
      if (!error && data) {
        setLateArrivals(data);
      }
    } catch (error) {
      console.error('Error fetching late arrivals:', error);
    } finally {
      setLoadingLateArrivals(false);
    }
  };

  const handleToggleLateArrivals = () => {
    if (!isLateArrivalsExpanded && lateArrivals.length === 0) {
      fetchLateArrivals(customer.phone || '');
    }
    setIsLateArrivalsExpanded(!isLateArrivalsExpanded);
  };

  const fetchNoShows = async (customerPhone: string) => {
    if (!companyId) return;
    setLoadingNoShows(true);
    try {
      const { data, error } = await supabase
        .from('customer_reservation_history')
        .select('reservation_date, party_size')
        .eq('company_id', companyId)
        .eq('customer_phone', customerPhone)
        .eq('event_type', 'no_show')
        .order('reservation_date', { ascending: false });
      
      if (!error && data) {
        setNoShows(data);
      }
    } catch (error) {
      console.error('Error fetching no-shows:', error);
    } finally {
      setLoadingNoShows(false);
    }
  };

  const handleToggleNoShows = () => {
    if (!isNoShowsExpanded && noShows.length === 0) {
      fetchNoShows(customer.phone || '');
    }
    setIsNoShowsExpanded(!isNoShowsExpanded);
  };

  const handleBlockAction = (action: string) => {
    toast({
      title: "Feature coming soon",
      description: `${action} functionality will be available soon.`
    });
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {customer.name}
          {customer.vip_status && getStatusBadge(customer)}
        </DialogTitle>
        <DialogDescription>
          Complete customer information and management options
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="space-y-6 mt-4">

      {/* Contact Information */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-foreground">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <div className="w-full">
              <p className="text-xs text-muted-foreground mb-1">Email</p>
              <PrivateInfo type="email" value={customer.email || 'No email provided'} isVisible={true} className="text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <div className="w-full">
              <p className="text-xs text-muted-foreground mb-1">Phone</p>
              <PrivateInfo type="phone" value={customer.phone || 'No phone provided'} isVisible={true} className="text-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Visit History */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-foreground">Visit History</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div 
            onClick={handleToggleVisitHistory}
            className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted cursor-pointer hover:bg-muted/80 transition-colors"
          >
            <div>
              <p className="text-xs text-muted-foreground">Total Visits</p>
              <p className="font-semibold text-lg">{completedVisitsCount || 0}</p>
            </div>
            {isVisitHistoryExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          {(() => {
            return (
              <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted">
                <div>
                  <p className="text-xs text-muted-foreground">Last Visit</p>
                  <p className="font-semibold text-sm">
                    {loadingVisits ? (
                      <Skeleton className="h-5 w-24 inline-block" />
                    ) : lastVisitFromQuery ? (
                      format(new Date(lastVisitFromQuery), 'MMM dd, yyyy')
                    ) : customer.last_visit ? (
                      format(new Date(getSafeLastVisit(customer.last_visit) || ''), 'MMM dd, yyyy')
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
              </div>
            );
          })()}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <div>
              <p className="text-xs text-muted-foreground">Total Spent</p>
              <p className="font-semibold text-lg">
                {loadingTotalSpent ? '...' : `£${totalSpent.toFixed(2)}`}
              </p>
            </div>
          </div>
        </div>
        
        {/* Expandable Visit List */}
        {isVisitHistoryExpanded && (
          <div className="md:col-span-3">
            <ScrollArea className="h-[280px] rounded-lg border bg-muted/50 p-3">
              {loadingVisits ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">Loading visits...</div>
                </div>
              ) : customerVisits.length > 0 ? (
                <div className="space-y-2">
                  {customerVisits.map((visit, index) => (
                    <div 
                      key={`${visit.date}-${index}`}
                      className="flex items-center justify-between p-2 rounded-md bg-background/50 hover:bg-background transition-colors"
                    >
                      <span className="text-sm font-medium">
                        {format(new Date(visit.date), 'MMM dd, yyyy')}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Party of {visit.party_size}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">No completed visits found</div>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Reliability Metrics */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-foreground">Reliability</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Late Arrivals */}
          <div 
            onClick={handleToggleLateArrivals}
            className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted cursor-pointer hover:bg-muted/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Clock className={cn("w-5 h-5", 
                !customer.late_count || customer.late_count === 0 
                  ? 'text-green-600' 
                  : customer.late_count <= 3 
                    ? 'text-yellow-600' 
                    : 'text-red-600'
              )} />
              <div>
                <p className="text-xs text-muted-foreground">Late Arrivals</p>
                <p className={cn("font-semibold text-lg", 
                  !customer.late_count || customer.late_count === 0 
                    ? 'text-green-600' 
                    : customer.late_count <= 3 
                      ? 'text-yellow-600' 
                      : 'text-red-600'
                )}>
                  {customer.late_count || 0}
                </p>
              </div>
            </div>
            {isLateArrivalsExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          
          {/* Expandable Late Arrivals List */}
          {isLateArrivalsExpanded && (
            <div className="md:col-span-3">
              <ScrollArea className="h-[280px] rounded-lg border bg-muted/50 p-3">
                {loadingLateArrivals ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">Loading late arrivals...</div>
                  </div>
                ) : lateArrivals.length > 0 ? (
                  <div className="space-y-2">
                    {lateArrivals.map((arrival, index) => (
                      <div 
                        key={`late-${arrival.reservation_date}-${index}`}
                        className="flex items-center justify-between p-2 rounded-md bg-background/50 hover:bg-background transition-colors"
                      >
                        <span className="text-sm font-medium">
                          {format(new Date(arrival.reservation_date), 'MMM dd, yyyy')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Party of {arrival.party_size}</span>
                          {arrival.minutes_late && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm font-medium text-orange-600">{arrival.minutes_late} min late</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">No late arrivals found</div>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
          
          {/* No-Shows */}
          <div 
            onClick={handleToggleNoShows}
            className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted cursor-pointer hover:bg-muted/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <UserX className={cn("w-5 h-5",
                !customer.no_show_count || customer.no_show_count === 0 
                  ? 'text-green-600' 
                  : customer.no_show_count <= 2 
                    ? 'text-yellow-600' 
                    : 'text-red-600'
              )} />
              <div>
                <p className="text-xs text-muted-foreground">No-Shows</p>
                <p className={cn("font-semibold text-lg",
                  !customer.no_show_count || customer.no_show_count === 0 
                    ? 'text-green-600' 
                    : customer.no_show_count <= 2 
                      ? 'text-yellow-600' 
                      : 'text-red-600'
                )}>
                  {customer.no_show_count ?? 0}
                </p>
              </div>
            </div>
            {isNoShowsExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          
          {/* Expandable No Shows List */}
          {isNoShowsExpanded && (
            <div className="md:col-span-3">
              <ScrollArea className="h-[280px] rounded-lg border bg-muted/50 p-3">
                {loadingNoShows ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">Loading no-shows...</div>
                  </div>
                ) : noShows.length > 0 ? (
                  <div className="space-y-2">
                    {noShows.map((noShow, index) => (
                      <div 
                        key={`noshow-${noShow.reservation_date}-${index}`}
                        className="flex items-center justify-between p-2 rounded-md bg-background/50 hover:bg-background transition-colors"
                      >
                        <span className="text-sm font-medium">
                          {format(new Date(noShow.reservation_date), 'MMM dd, yyyy')}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Party of {noShow.party_size}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">No no-shows found</div>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
          
          {/* Average Lateness (only if late_count > 0) */}
          {(customer.late_count ?? 0) > 0 && (customer.average_minutes_late ?? 0) > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Timer className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Avg. Lateness</p>
                <p className="font-semibold text-lg">{Math.round(customer.average_minutes_late)} min</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preferences */}
      {customer.preferences && customer.preferences.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-foreground">Preferences</h3>
          <div className="flex flex-wrap gap-2">
            {customer.preferences.map((pref, index) => (
              <Badge key={index} variant="secondary">
                {pref}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {customer.notes && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-foreground">Notes</h3>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 pt-4 border-t">
        <h3 className="font-semibold text-sm text-foreground">Management Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button 
            variant="outline"
            className="w-full border-yellow-300 text-yellow-700 hover:bg-yellow-50"
            onClick={() => handleBlockAction('Block Takeaway')}
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            Block Takeaway
          </Button>
          <Button 
            variant="outline"
            className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={() => handleBlockAction('Block Reservation')}
          >
            <CalendarX className="w-4 h-4 mr-2" />
            Block Reservation
          </Button>
          <Button 
            variant="destructive"
            className="w-full"
            onClick={() => handleBlockAction('Block Customer')}
          >
            <Ban className="w-4 h-4 mr-2" />
            Block Customer
          </Button>
        </div>
      </div>
      </TabsContent>
      
      <TabsContent value="orders" className="mt-4">
        <CustomerOrderHistory 
          customerId={customer.id} 
          companyId={companyId!} 
        />
      </TabsContent>
    </Tabs>
    </div>
  );
};

export default CustomerCRM;
