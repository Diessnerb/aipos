
import React, { useState, useEffect } from 'react';
import { formatCustomerName } from '@/utils/nameUtils';
import { ALLERGEN_LIST } from '@/utils/allergens';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Lock, Unlock, Search, UserCheck, UserPlus, Crown } from 'lucide-react';
import { Reservation } from '@/types/reservation';
import { useAuth } from '@/components/AuthProvider';
import { useCustomersQuery } from '@/hooks/useCustomersQuery';
import { normalizeUKPhone } from '@/utils/phoneUtils';
import { useDebounce } from '@/hooks/useDebounce';

interface ReservationFormProps {
  reservation?: Reservation | null;
  onSave: (reservation: Reservation) => void;
  onCancel: () => void;
}

export const ReservationForm: React.FC<ReservationFormProps> = ({
  reservation,
  onSave,
  onCancel,
}) => {
  const { companyId } = useAuth();
  const { customers } = useCustomersQuery();
  
  const [formData, setFormData] = useState({
    customer_name: '',
    phone: '',
    email: '',
    party_size: 2,
    date: new Date().toISOString().split('T')[0],
    time: '19:00',
    table_number: undefined as number | undefined,
    notes: '',
    status: 'confirmed' as Reservation['status'],
    locked: false,
    locked_until: null as string | null,
    has_allergens: false,
    allergens: [] as string[],
  });
  
  // State for customer lookup
  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  
  // Debounce phone input to avoid excessive lookups
  const debouncedPhone = useDebounce(phoneInput, 300);

  // Customer lookup effect - triggered when phone changes
  useEffect(() => {
    if (!debouncedPhone || !companyId) {
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
  }, [debouncedPhone, customers, companyId]);

  useEffect(() => {
    if (reservation) {
      setFormData({
        customer_name: reservation.customer_name,
        phone: reservation.phone,
        email: reservation.email,
        party_size: reservation.party_size,
        date: reservation.date,
        time: reservation.time,
        table_number: reservation.table_number,
        notes: reservation.notes || '',
        status: reservation.status,
        locked: reservation.locked || false,
        locked_until: reservation.locked_until || null,
        has_allergens: reservation.has_allergens || false,
        allergens: reservation.allergens || [],
      });
      
      // Set initial phone input
      setPhoneInput(reservation.phone);
      
      // Clear found customer state (we're editing, not creating)
      setFoundCustomer(null);
    } else {
      // Clear form for new reservation
      setPhoneInput('');
      setFoundCustomer(null);
    }
  }, [reservation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const reservationData: Reservation = {
      id: reservation?.id || crypto.randomUUID(),
      ...formData,
      customer_name: formatCustomerName(formData.customer_name),
      // Include metadata about found customer for downstream processing
      _foundCustomerId: foundCustomer?.id,
    } as any;
    onSave(reservationData);
  };
  
  const handlePhoneChange = (value: string) => {
    setPhoneInput(value);
    
    // If user clears phone or changes it significantly, clear found customer
    if (!value || value.length < 5) {
      setFoundCustomer(null);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleLock = () => {
    setFormData(prev => ({
      ...prev, 
      locked: !prev.locked,
      locked_until: prev.locked ? null : prev.locked_until // Clear locked_until when unlocking
    }));
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {reservation ? 'Edit Reservation' : 'New Reservation'}
        </DialogTitle>
      </DialogHeader>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Phone Number - First field for customer lookup */}
        <div>
          <Label htmlFor="phone" className="flex items-center gap-2">
            Phone Number
            {isSearchingCustomer && (
              <Search className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            {foundCustomer && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <UserCheck className="h-3 w-3" />
                Customer found
              </span>
            )}
            {!foundCustomer && phoneInput.length >= 10 && (
              <span className="flex items-center gap-1 text-xs text-blue-600">
                <UserPlus className="h-3 w-3" />
                New customer
              </span>
            )}
          </Label>
          <Input
            id="phone"
            value={phoneInput}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="07123 456789"
            required
            autoComplete="tel"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter phone to search existing customers
          </p>
        </div>

        {/* Customer Status Badge */}
        {foundCustomer && (
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

        {/* Customer Name - Second field, auto-filled if found */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="customer_name" className="flex items-center gap-2">
              Customer Name
              {foundCustomer && (
                <span className="text-xs text-muted-foreground">(Auto-filled)</span>
              )}
            </Label>
            <Input
              id="customer_name"
              value={formData.customer_name}
              onChange={(e) => handleInputChange('customer_name', e.target.value)}
              onBlur={(e) => handleInputChange('customer_name', formatCustomerName(e.target.value))}
              required
              readOnly={!!foundCustomer}
              disabled={!!foundCustomer}
              className={foundCustomer ? 'bg-muted cursor-not-allowed' : ''}
              placeholder={foundCustomer ? '' : 'Enter customer name'}
            />
          </div>
          
          <div>
            <Label htmlFor="email" className="flex items-center gap-2">
              Email
              {foundCustomer && formData.email && (
                <span className="text-xs text-muted-foreground">(Auto-filled)</span>
              )}
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              readOnly={!!foundCustomer && !!formData.email}
              disabled={!!foundCustomer && !!formData.email}
              className={foundCustomer && formData.email ? 'bg-muted cursor-not-allowed' : ''}
              placeholder={foundCustomer ? '' : 'customer@email.com (optional)'}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="party_size">Party Size</Label>
            <Input
              id="party_size"
              type="number"
              min="1"
              value={formData.party_size}
              onChange={(e) => handleInputChange('party_size', parseInt(e.target.value))}
              required
            />
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={formData.time}
              onChange={(e) => handleInputChange('time', e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="table_number">Table Number (Optional)</Label>
            <Input
              id="table_number"
              type="number"
              min="1"
              value={formData.table_number || ''}
              onChange={(e) => handleInputChange('table_number', e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value as Reservation['status'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="seated">Seated</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no-show">No Show</SelectItem>
              </SelectContent>
            </Select>
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
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={toggleLock}
              className="p-2"
              title={formData.locked ? "Unlock reservation (allow moving on timeline)" : "Lock reservation (prevent moving on timeline)"}
            >
              {formData.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
          <Button type="submit">
            {reservation ? 'Update' : 'Create'} Reservation
          </Button>
        </div>
      </form>
    </>
  );
};
