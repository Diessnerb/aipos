/**
 * Customer Visit Service
 * Handles visit counting when reservations are completed
 */

import { supabase } from '@/integrations/supabase/client';
import { normalizeUKPhone } from '@/utils/phoneUtils';

export class CustomerVisitService {
  /**
   * Increment visit count for a customer when their reservation is completed
   * 
   * @param companyId - Company UUID
   * @param phone - Customer's phone number
   * @param reservationDate - Date of the completed reservation
   * @returns Success status
   */
  static async incrementVisitCount(
    companyId: string,
    phone: string,
    reservationDate: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!phone) {
        return { success: false, error: 'Phone number required' };
      }

      // Normalize phone for consistent matching
      const normalizedPhone = normalizeUKPhone(phone);
      if (!normalizedPhone || normalizedPhone.length !== 11) {
        console.error('❌ Invalid phone for visit increment:', phone, 'Normalized:', normalizedPhone);
        return { success: false, error: 'Invalid phone number format' };
      }

      console.log('🔍 Incrementing visit count for phone:', normalizedPhone);

      // Find customer by phone
      const { data: customers, error: fetchError } = await supabase
        .from('customers')
        .select('id, visits, last_visit, phone')
        .eq('company_id', companyId)
        .eq('phone', normalizedPhone);

      if (fetchError) {
        console.error('Error fetching customer for visit increment:', fetchError);
        return { success: false, error: fetchError.message };
      }

      if (!customers || customers.length === 0) {
        console.warn('⚠️ No customer found with phone:', normalizedPhone);
        return { success: false, error: 'Customer not found' };
      }

      const customer = customers[0];
      
      // CRITICAL: Verify phone match before incrementing
      if (customer.phone !== normalizedPhone) {
        console.error('❌ CRITICAL: Phone mismatch in visit increment!', {
          queriedPhone: normalizedPhone,
          foundCustomerPhone: customer.phone,
          foundCustomerId: customer.id
        });
        return { success: false, error: 'Customer phone mismatch' };
      }

      console.log('✅ Phone match verified for visit increment:', customer.id);
      
      // Defensive check: only update last_visit if reservationDate is not in the future
      const today = new Date().toISOString().split('T')[0];
      const updatePayload: any = {
        visits: (customer.visits || 0) + 1,
      };
      
      if (reservationDate && reservationDate <= today) {
        updatePayload.last_visit = reservationDate;
      } else {
        console.warn('⚠️ Reservation date is in the future, not updating last_visit:', reservationDate);
      }
      
      const { error: updateError } = await supabase
        .from('customers')
        .update(updatePayload)
        .eq('id', customer.id);

      if (updateError) {
        console.error('Error incrementing visit count:', updateError);
        return { success: false, error: updateError.message };
      }

      console.log('✅ Visit count incremented for customer:', customer.id, 'New count:', (customer.visits || 0) + 1);
      return { success: true };
    } catch (error: any) {
      console.error('Customer visit increment error:', error);
      return { success: false, error: error.message };
    }
  }
}
