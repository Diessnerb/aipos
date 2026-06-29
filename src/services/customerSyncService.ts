/**
 * Customer Sync Service
 * Automatically creates or updates customers in the CRM based on reservation data
 * Phone number is the unique identifier for customers
 */

import { supabase } from '@/integrations/supabase/client';
import { normalizeUKPhone } from '@/utils/phoneUtils';

export class CustomerSyncService {
  /**
   * Syncs customer data from a reservation
   * Creates new customer if phone doesn't exist, updates if it does
   * 
   * @param companyId - Company UUID
   * @param customerName - Customer's name
   * @param phone - Customer's phone number (unique identifier)
   * @param email - Optional customer email
   * @param reservationDate - Date of the reservation
   * @param isPinMode - Whether operating in PIN mode
   * @param pin - PIN for authentication (required in PIN mode)
   * @returns Success status and customer ID
   */
  static async syncCustomerFromReservation(
    companyId: string,
    customerName: string,
    phone: string,
    email?: string,
    reservationDate?: string,
    isPinMode: boolean = false,
    pin?: string
  ): Promise<{ success: boolean; customerId?: string; error?: string }> {
    try {
      // Validate required fields
      if (!phone || !customerName) {
        return { success: false, error: 'Phone and name are required' };
      }

      // Normalize phone number for consistent matching
      const normalizedPhone = normalizeUKPhone(phone);
      if (!normalizedPhone) {
        return { success: false, error: 'Invalid phone number format' };
      }

      // In PIN mode, use edge function for customer sync
      if (isPinMode && pin) {
        const { data, error } = await supabase.functions.invoke('pin-customer-save', {
          body: {
            pin,
            companyId,
            operation: 'upsert',
            customer: {
              name: customerName,
              phone: normalizedPhone,
              email: email || null,
            }
          }
        });

        if (error) {
          console.error('PIN customer sync error:', error);
          return { success: false, error: error.message };
        }

        return { 
          success: data?.success || false, 
          customerId: data?.data?.id,
          error: data?.error 
        };
      }

      // Standard mode: Use Supabase client directly
      try {
        // CRITICAL: Verify normalized phone is valid and 11 digits
        if (!normalizedPhone || normalizedPhone.length !== 11) {
          console.error('❌ Invalid normalized phone:', normalizedPhone);
          return { success: false, error: 'Invalid phone number format' };
        }

        console.log('🔄 Customer sync starting:', { customerName, phone: normalizedPhone, companyId });

        // Check if customer exists with this phone
        const { data: existingCustomers, error: fetchError } = await supabase
          .from('customers')
          .select('id, name, email, visits, last_visit, phone')
          .eq('company_id', companyId)
          .eq('phone', normalizedPhone);

        if (fetchError) {
          console.error('Error fetching customer:', fetchError);
          return { success: false, error: fetchError.message };
        }

        console.log('🔍 Existing customers found:', existingCustomers?.length || 0);

        if (existingCustomers && existingCustomers.length > 0) {
          // CRITICAL: Verify we're updating the correct customer
          const customer = existingCustomers[0];
          
          if (customer.phone !== normalizedPhone) {
            console.error('❌ CRITICAL: Phone mismatch detected!', {
              queriedPhone: normalizedPhone,
              foundCustomerPhone: customer.phone,
              foundCustomerId: customer.id
            });
            return { success: false, error: 'Customer phone mismatch - aborting to prevent data corruption' };
          }

          console.log('✅ Found existing customer with matching phone:', customer.id);

          // Update existing customer
          const updateData: any = {
            name: customerName,
          };

          // Update email if provided
          if (email) {
            updateData.email = email;
          }

          const { error: updateError } = await supabase
            .from('customers')
            .update(updateData)
            .eq('id', customer.id);

          if (updateError) {
            console.error('Error updating customer:', updateError);
            return { success: false, error: updateError.message };
          }

          console.log('✅ Customer updated:', customer.id);
          return { success: true, customerId: customer.id };
        } else {
          // Create new customer
          const insertData: any = {
            company_id: companyId,
            name: customerName,
            phone: normalizedPhone,
            email: email || null,
            visits: 0, // Start at 0, will increment when reservation is completed
            last_visit: null, // Will be set when first reservation is completed
          };

          const { data: newCustomer, error: insertError } = await supabase
            .from('customers')
            .insert(insertData)
            .select('id')
            .single();

          if (insertError) {
            console.error('Error creating customer:', insertError);
            return { success: false, error: insertError.message };
          }

          console.log('✅ New customer created:', newCustomer.id);
          return { success: true, customerId: newCustomer.id };
        }
      } catch (error: any) {
        console.error('❌ Customer sync failed:', error);
        return { success: false, error: error.message };
      }
    } catch (error: any) {
      console.error('Customer sync error:', error);
      return { success: false, error: error.message };
    }
  }
}
