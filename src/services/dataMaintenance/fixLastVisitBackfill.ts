/**
 * Data Maintenance Utility: Fix Future Last Visit Dates
 * 
 * This utility repairs customer records where last_visit is set to a future date,
 * which should never happen as last_visit should only reflect completed reservations.
 */

import { supabase } from '@/integrations/supabase/client';
import { normalizeUKPhone } from '@/utils/phoneUtils';

export interface FixLastVisitResult {
  success: boolean;
  customersFixed: number;
  customersCleared: number;
  errors: string[];
}

/**
 * Fix customers with future last_visit dates by finding their most recent
 * completed reservation or clearing the date if none exists.
 */
export async function fixFutureLastVisits(companyId: string): Promise<FixLastVisitResult> {
  const result: FixLastVisitResult = {
    success: false,
    customersFixed: 0,
    customersCleared: 0,
    errors: []
  };

  try {
    const today = new Date().toISOString().split('T')[0];

    // Find all customers with future last_visit dates
    const { data: customers, error: fetchError } = await supabase
      .from('customers')
      .select('id, phone, last_visit, name')
      .eq('company_id', companyId)
      .gt('last_visit', today);

    if (fetchError) {
      result.errors.push(`Error fetching customers: ${fetchError.message}`);
      return result;
    }

    if (!customers || customers.length === 0) {
      result.success = true;
      console.log('✅ No customers with future last_visit dates found');
      return result;
    }

    console.log(`🔧 Found ${customers.length} customers with future last_visit dates`);

    // Process each customer
    for (const customer of customers) {
      try {
        const normalizedPhone = customer.phone ? normalizeUKPhone(customer.phone) : null;
        
        if (!normalizedPhone) {
          console.warn(`⚠️ Customer ${customer.id} has no valid phone, clearing last_visit`);
          await supabase
            .from('customers')
            .update({ last_visit: null })
            .eq('id', customer.id);
          result.customersCleared++;
          continue;
        }

        // Find most recent completed reservation on or before today
        const { data: reservation, error: resError } = await supabase
          .from('reservations')
          .select('date')
          .eq('company_id', companyId)
          .eq('phone', normalizedPhone)
          .eq('status', 'completed')
          .lte('date', today)
          .order('date', { ascending: false })
          .limit(1)
          .single();

        if (resError && resError.code !== 'PGRST116') { // PGRST116 = no rows
          result.errors.push(`Error fetching reservation for ${customer.name}: ${resError.message}`);
          continue;
        }

        // Update customer with correct last_visit
        const newLastVisit = reservation?.date || null;
        
        const { error: updateError } = await supabase
          .from('customers')
          .update({ last_visit: newLastVisit })
          .eq('id', customer.id);

        if (updateError) {
          result.errors.push(`Error updating ${customer.name}: ${updateError.message}`);
          continue;
        }

        if (newLastVisit) {
          console.log(`✅ Fixed ${customer.name}: ${customer.last_visit} → ${newLastVisit}`);
          result.customersFixed++;
        } else {
          console.log(`✅ Cleared ${customer.name}: ${customer.last_visit} → null`);
          result.customersCleared++;
        }
      } catch (err: any) {
        result.errors.push(`Unexpected error for ${customer.name}: ${err.message}`);
      }
    }

    result.success = result.errors.length === 0;
    
    console.log('🔧 Repair Summary:', {
      fixed: result.customersFixed,
      cleared: result.customersCleared,
      errors: result.errors.length
    });

    return result;
  } catch (error: any) {
    result.errors.push(`Fatal error: ${error.message}`);
    return result;
  }
}
